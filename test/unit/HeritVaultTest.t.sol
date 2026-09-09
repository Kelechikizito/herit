// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {HeritVault} from "src/HeritVault.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {
    ContractWalletHeir,
    FeeOnTransferERC20,
    MockERC20,
    MockGrantorRegistry,
    MockHeritRegistry,
    RejectingHeir
} from "test/utils/VaultMocks.sol";

/// @dev Written before `HeritVault` exists, so it is a specification as much as a test: until the
///      contract below is written the file does not compile, and every failure names a rule the
///      vault has to obey. The API it assumes, from `documents/checkpoint-6-guide.md`:
///
///        constructor(IPermissionedRegistry grantorRegistry,
///                    IHeritRegistry heritRegistry,
///                    address claimManager)
///
///        depositETH(uint256 estateId) payable
///        depositERC20(uint256 estateId, address token, uint256 amount)
///        withdraw(uint256 estateId, address token, uint256 amount)
///        snapshot(uint256 estateId)                                        HeritRegistry only
///        payOut(uint256 estateId, address token, address to, uint16 shareBps)
///                                                          returns (uint256)  ClaimManager only
///
///        balanceOf(uint256 estateId, address token)  view returns (uint256)
///        snapshotOf(uint256 estateId, address token) view returns (uint256)
///
///      Rename anything here freely — the names are not the point, the arithmetic is. Every
///      `vm.expectRevert()` is deliberately untyped so your error names stay yours; tighten them
///      to selectors once they exist.
contract HeritVaultTest is Test {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev The key ETH is filed under, the same value the share matrix must use in Checkpoint 7.
    address internal constant NATIVE = address(0);

    /// @dev The cap on distinct tokens per estate. If you pick a different number, change it here
    ///      too — `testDepositBeyondTheTokenCapReverts` is the only place it is assumed.
    uint256 internal constant MAX_TOKENS = 10;

    /// @dev The estate id is the grantor's labelhash, exactly as `AccessControlGate` computes it.
    uint256 internal constant ESTATE_ID = uint256(keccak256(bytes("alice")));

    /// @dev An estate `openEstate` was never called for. Registry A returns the zero owner for it.
    uint256 internal constant UNOPENED_ESTATE_ID = uint256(keccak256(bytes("nobody")));

    uint16 internal constant SON_SHARE_BPS = 6000;
    uint16 internal constant DAUGHTER_SHARE_BPS = 4000;

    HeritVault internal vault;
    MockGrantorRegistry internal registryA;
    MockHeritRegistry internal heritRegistry;
    MockERC20 internal usdc;

    address internal alice = makeAddr("alice");
    address internal son = makeAddr("son");
    address internal daughter = makeAddr("daughter");
    address internal stranger = makeAddr("stranger");
    address internal claimManager = makeAddr("claimManager");

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        registryA = new MockGrantorRegistry();
        heritRegistry = new MockHeritRegistry();

        vault = new HeritVault(
            IPermissionedRegistry(address(registryA)), IHeritRegistry(address(heritRegistry)), claimManager
        );

        /// @dev Alice owns `alice.herit.eth` in registry A, which is what makes her the grantor.
        registryA.setOwner(ESTATE_ID, alice);

        /// @dev Six decimals, like the MockUSDC in the frozen ENS set the demo spends.
        usdc = new MockERC20("Mock USDC", "USDC", 6);
        usdc.mint(alice, 1_000e6);

        vm.deal(alice, 1_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                           DEPOSIT AND WITHDRAW
    //////////////////////////////////////////////////////////////*/

    function testGrantorDepositsAndWithdrawsEth() public {
        vm.prank(alice);
        vault.depositETH{value: 10 ether}(ESTATE_ID);
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 10 ether, "deposit not credited");

        vm.prank(alice);
        vault.withdraw(ESTATE_ID, NATIVE, 4 ether);
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 6 ether, "withdrawal not debited");
        assertEq(alice.balance, 994 ether, "money did not reach the grantor");
    }

    function testGrantorDepositsAndWithdrawsErc20() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 500e6);
        vault.depositERC20(ESTATE_ID, address(usdc), 500e6);
        assertEq(vault.balanceOf(ESTATE_ID, address(usdc)), 500e6, "deposit not credited");

        vault.withdraw(ESTATE_ID, address(usdc), 200e6);
        vm.stopPrank();

        assertEq(vault.balanceOf(ESTATE_ID, address(usdc)), 300e6, "withdrawal not debited");
        assertEq(usdc.balanceOf(alice), 700e6, "tokens did not reach the grantor");
    }

    /// @dev A stranger depositing is not generous, it is a gas-griefing vector: every new token
    ///      lengthens the list `snapshot` has to walk at unlock.
    function testOnlyTheGrantorCanDeposit() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert();
        vault.depositETH{value: 1 ether}(ESTATE_ID);
    }

    function testOnlyTheGrantorCanWithdraw() public {
        vm.prank(alice);
        vault.depositETH{value: 1 ether}(ESTATE_ID);

        vm.prank(stranger);
        vm.expectRevert();
        vault.withdraw(ESTATE_ID, NATIVE, 1 ether);
    }

    /// @dev Registry A returns the zero owner, so there is no grantor and the money would land in a
    ///      mapping key nobody can reach.
    function testDepositToAnUnopenedEstateReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.depositETH{value: 1 ether}(UNOPENED_ESTATE_ID);
    }

    function testZeroValueDepositReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.depositETH{value: 0}(ESTATE_ID);
    }

    function testWithdrawingMoreThanTheBalanceReverts() public {
        vm.prank(alice);
        vault.depositETH{value: 1 ether}(ESTATE_ID);

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(ESTATE_ID, NATIVE, 2 ether);
    }

    /// @dev Grace is the false-alarm window. The grantor is presumed alive, so their money stays
    ///      theirs — this is the case a status check written as `!= Active` would get wrong.
    function testWithdrawStillWorksDuringGrace() public {
        vm.prank(alice);
        vault.depositETH{value: 5 ether}(ESTATE_ID);

        heritRegistry.setStatus(ESTATE_ID, IHeritRegistry.Status.Grace);

        vm.prank(alice);
        vault.withdraw(ESTATE_ID, NATIVE, 5 ether);
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 0, "grace withdrawal was refused");
    }

    function testWithdrawRevertsOnceUnlocked() public {
        _fundAndUnlock(10 ether);

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(ESTATE_ID, NATIVE, 1 ether);
    }

    /// @dev The snapshot is already taken, so a late deposit is invisible to every percentage and
    ///      withdrawable by nobody. Bounce it at the door rather than swallowing it.
    function testDepositRevertsOnceUnlocked() public {
        _fundAndUnlock(10 ether);

        vm.prank(alice);
        vm.expectRevert();
        vault.depositETH{value: 1 ether}(ESTATE_ID);
    }

    /*//////////////////////////////////////////////////////////////
                                SNAPSHOT
    //////////////////////////////////////////////////////////////*/

    function testOnlyHeritRegistryCanSnapshot() public {
        vm.prank(alice);
        vault.depositETH{value: 1 ether}(ESTATE_ID);

        vm.prank(stranger);
        vm.expectRevert();
        vault.snapshot(ESTATE_ID);
    }

    function testSnapshotCopiesEveryTokenTheEstateHolds() public {
        vm.startPrank(alice);
        vault.depositETH{value: 7 ether}(ESTATE_ID);
        usdc.approve(address(vault), 300e6);
        vault.depositERC20(ESTATE_ID, address(usdc), 300e6);
        vm.stopPrank();

        _unlock();

        assertEq(vault.snapshotOf(ESTATE_ID, NATIVE), 7 ether, "ETH not snapshotted");
        assertEq(vault.snapshotOf(ESTATE_ID, address(usdc)), 300e6, "ERC20 not snapshotted");
    }

    /// @dev `pokeExpiry` is permissionless, so two callers can poke in the same block. The second
    ///      snapshot must change nothing — re-running it after a payout would shrink the ruler and
    ///      short-change whoever claims last — and must not revert, or the second poke fails whole.
    function testSnapshotTwiceChangesNothing() public {
        _fundAndUnlock(100 ether);

        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, NATIVE, son, SON_SHARE_BPS);

        vm.prank(address(heritRegistry));
        vault.snapshot(ESTATE_ID);

        assertEq(vault.snapshotOf(ESTATE_ID, NATIVE), 100 ether, "the ruler moved");

        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, NATIVE, daughter, DAUGHTER_SHARE_BPS);
        assertEq(daughter.balance, 40 ether, "second heir short-changed by a re-snapshot");
    }

    /*//////////////////////////////////////////////////////////////
                                 PAY OUT
    //////////////////////////////////////////////////////////////*/

    function testOnlyClaimManagerCanPayOut() public {
        _fundAndUnlock(10 ether);

        vm.prank(stranger);
        vm.expectRevert();
        vault.payOut(ESTATE_ID, NATIVE, stranger, 10_000);
    }

    /// @dev The checkpoint in one test. Son takes 60% first; 40 ether is left; 40% of what is left
    ///      would be 16. Daughter must get 40, which is only true if her share is measured against
    ///      the snapshot rather than the live balance.
    function testSharesAreMeasuredAgainstTheSnapshotNotTheBalance() public {
        _fundAndUnlock(100 ether);

        vm.prank(claimManager);
        uint256 paidToSon = vault.payOut(ESTATE_ID, NATIVE, son, SON_SHARE_BPS);

        vm.prank(claimManager);
        uint256 paidToDaughter = vault.payOut(ESTATE_ID, NATIVE, daughter, DAUGHTER_SHARE_BPS);

        assertEq(paidToSon, 60 ether, "wrong amount reported for the first heir");
        assertEq(paidToDaughter, 40 ether, "the second heir was paid a share of the leftovers");
        assertEq(son.balance, 60 ether, "first heir underpaid");
        assertEq(daughter.balance, 40 ether, "second heir underpaid");
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 0, "the estate should be empty");
    }

    function testErc20SharesSplitExactly() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.depositERC20(ESTATE_ID, address(usdc), 1_000e6);
        vm.stopPrank();

        _unlock();

        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, address(usdc), son, SON_SHARE_BPS);
        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, address(usdc), daughter, DAUGHTER_SHARE_BPS);

        assertEq(usdc.balanceOf(son), 600e6, "first heir underpaid");
        assertEq(usdc.balanceOf(daughter), 400e6, "second heir underpaid");
        assertEq(vault.balanceOf(ESTATE_ID, address(usdc)), 0, "the estate should be empty");
    }

    /// @dev Truncation is fine and every vault has it. What is not fine is the total exceeding the
    ///      snapshot, which is what a rounding "fix" usually introduces.
    function testRoundingDustStaysInTheVault() public {
        _fundAndUnlock(100 wei);

        vm.startPrank(claimManager);
        vault.payOut(ESTATE_ID, NATIVE, son, 3333);
        vault.payOut(ESTATE_ID, NATIVE, daughter, 3333);
        vault.payOut(ESTATE_ID, NATIVE, stranger, 3333);
        vm.stopPrank();

        assertEq(son.balance, 33, "truncation went the wrong way");
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 1, "dust should stay put, not be swept");
    }

    /// @dev Plenty of heirs use a smart-contract wallet. `payable(to).transfer` forwards 2300 gas,
    ///      which is not enough for one to write storage on receipt, so this fails unless the vault
    ///      pays with `call`.
    function testPayOutReachesAContractWallet() public {
        ContractWalletHeir wallet = new ContractWalletHeir();
        _fundAndUnlock(10 ether);

        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, NATIVE, address(wallet), 10_000);

        assertEq(wallet.received(), 10 ether, "a contract wallet could not be paid");
    }

    /// @dev A failed send must take the bookkeeping down with it. Marking the payout done and
    ///      losing the ETH is the worst outcome available to this contract.
    function testPayOutRevertsWhenTheHeirRejectsEth() public {
        RejectingHeir rejecting = new RejectingHeir();
        _fundAndUnlock(10 ether);

        vm.prank(claimManager);
        vm.expectRevert();
        vault.payOut(ESTATE_ID, NATIVE, address(rejecting), 10_000);

        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 10 ether, "balance moved on a failed send");
    }

    /*//////////////////////////////////////////////////////////////
                              AWKWARD TOKENS
    //////////////////////////////////////////////////////////////*/

    /// @dev 100 sent, 10% burned in flight, 90 arrived. Crediting 100 would leave the estate's
    ///      books ten tokens richer than the vault, and the last heir's transfer would revert.
    function testFeeOnTransferTokenCreditsWhatArrived() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20();
        fee.mint(alice, 100e18);

        vm.startPrank(alice);
        fee.approve(address(vault), 100e18);
        vault.depositERC20(ESTATE_ID, address(fee), 100e18);
        vm.stopPrank();

        assertEq(vault.balanceOf(ESTATE_ID, address(fee)), 90e18, "credited the amount asked for");

        _unlock();

        vm.prank(claimManager);
        vault.payOut(ESTATE_ID, address(fee), son, 10_000);

        assertEq(vault.balanceOf(ESTATE_ID, address(fee)), 0, "the estate should be empty");
        assertEq(IERC20(address(fee)).balanceOf(son), 81e18, "the second fee was not absorbed");
    }

    /// @dev The token list is walked in a loop at unlock, so its length is a gas budget. Without a
    ///      cap, a confused grantor with a wallet full of airdrops can brick their own estate.
    function testDepositBeyondTheTokenCapReverts() public {
        vm.startPrank(alice);
        vault.depositETH{value: 1 ether}(ESTATE_ID);

        for (uint256 i = 0; i < MAX_TOKENS; i++) {
            MockERC20 token = new MockERC20("Filler", "FILL", 18);
            token.mint(alice, 1e18);
            token.approve(address(vault), 1e18);

            /// @dev ETH already took one slot, so the last token in this loop is one too many.
            if (i == MAX_TOKENS - 1) {
                vm.expectRevert();
            }
            vault.depositERC20(ESTATE_ID, address(token), 1e18);
        }
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                 HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev What `HeritRegistry.pokeExpiry` will do on the final transition: flip the status, then
    ///      freeze the balances. Both, in that order, and never one without the other.
    function _unlock() internal {
        heritRegistry.setStatus(ESTATE_ID, IHeritRegistry.Status.Unlocked);
        vm.prank(address(heritRegistry));
        vault.snapshot(ESTATE_ID);
    }

    function _fundAndUnlock(uint256 amount) internal {
        vm.prank(alice);
        vault.depositETH{value: amount}(ESTATE_ID);
        _unlock();
    }
}
