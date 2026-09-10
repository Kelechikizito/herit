// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IEnhancedAccessControl} from "@ensdomains/contracts-v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {ClaimManager} from "src/ClaimManager.sol";
import {HeritRegistry} from "src/HeritRegistry.sol";
import {HeritVault} from "src/HeritVault.sol";
import {LivenessAttestor} from "src/LivenessAttestor.sol";
import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {IPermissionedResolverInit} from "src/interfaces/IPermissionedResolverInit.sol";
import {IUserRegistryInit} from "src/interfaces/IUserRegistryInit.sol";
import {MockERC20} from "test/utils/VaultMocks.sol";

/// @title HeritLifecycleTest
/// @notice The whole product in one file: all five contracts, wired to each other exactly as
///         `script/DeployHerit.s.sol` wires them, against the real ENSv2 registry on a Sepolia fork.
/// @dev Nothing here is mocked except the ERC20. Registry A, the resolver and both estate registries
///      are real proxies from the frozen hackathon factory, so a call that ENS would reject on
///      Sepolia is rejected here too.
contract HeritLifecycleTest is Test {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set, from `documents/deployments.md`, live on the fork.
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);
    address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;
    address internal constant PERMISSIONED_RESOLVER_IMPL = 0xa9d3814AB151BF6E37A427432795371a8361614e;

    uint256 internal constant REGISTRY_A_SALT = uint256(keccak256("herit.registry-a.lifecycle"));
    uint256 internal constant RESOLVER_SALT = uint256(keccak256("herit.resolver.lifecycle"));

    string internal constant GRANTOR_LABEL = "alice";
    string internal constant SON_LABEL = "son";
    string internal constant DAUGHTER_LABEL = "daughter";

    uint256 internal constant ESTATE_ID = uint256(keccak256(bytes(GRANTOR_LABEL)));
    uint256 internal constant SON_HASH = uint256(keccak256(bytes(SON_LABEL)));
    uint256 internal constant DAUGHTER_HASH = uint256(keccak256(bytes(DAUGHTER_LABEL)));

    uint16 internal constant SON_SHARE = 6000;
    uint16 internal constant DAUGHTER_SHARE = 4000;

    uint64 internal constant INTERVAL = 30 days;
    uint64 internal constant GRACE = 7 days;

    /// @dev ETH is filed under the zero address in the vault's token list.
    address internal constant NATIVE = address(0);

    uint256 internal constant ETH_DEPOSIT = 10 ether;
    uint256 internal constant USDC_DEPOSIT = 1_000e6;

    /// @dev One human, one commitment. These stand in for `keccak256(worldIdNullifier, salt)`,
    ///      which the backend computes after Cloud Verify passes.
    bytes32 internal constant ALICE_COMMITMENT = keccak256("alice-is-a-live-human");
    bytes32 internal constant SON_COMMITMENT = keccak256("son-is-a-live-human");
    bytes32 internal constant DAUGHTER_COMMITMENT = keccak256("daughter-is-a-live-human");
    bytes32 internal constant THIEF_COMMITMENT = keccak256("someone-else-entirely");

    IPermissionedRegistry internal registryA;
    address internal resolver;

    AccessControlGate internal gate;
    HeritRegistry internal registry;
    HeritVault internal vault;
    ClaimManager internal claims;
    LivenessAttestor internal attestor;

    MockERC20 internal usdc;

    address internal alice = makeAddr("alice");
    address internal son = makeAddr("son");
    address internal daughter = makeAddr("daughter");
    address internal stranger = makeAddr("stranger");

    address internal signer;
    uint256 internal signerKey;

    /// @dev Attestation nonces are global across every estate, so the suite hands them out here.
    uint256 internal nextNonce = 1;

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        string memory rpc = vm.envOr("ETH_SEPOLIA_RPC_URL", string(""));

        /// @dev CI has no RPC URL, so skip the whole file there instead of failing the build.
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        /// @dev These addresses carry live EIP-7702 delegations on Sepolia, which make the
        ///      ERC-1155 mint inside `register` revert.
        vm.etch(alice, "");
        vm.etch(son, "");
        vm.etch(daughter, "");

        (signer, signerKey) = makeAddrAndKey("attestorSigner");

        _deployEnsLayer();
        _deployHerit();

        registryA.grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(gate));
        IEnhancedAccessControl(resolver).grantRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, address(gate));

        usdc = new MockERC20("Mock USDC", "USDC", 6);
        usdc.mint(alice, USDC_DEPOSIT);
        vm.deal(alice, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                             THE MAIN PATH
    //////////////////////////////////////////////////////////////*/

    /// @notice Setup, funding, a check-in, a missed window, grace, unlock, and both heirs paid.
    /// @dev This is the demo script as a test. If one assertion here fails, the demo fails.
    function testFullLifecycle() public {
        // ARRANGE — an estate with two heirs and money in it.
        _openEstateWithHeirs();
        _fundVault();

        // ACT 1 — the first Selfie Check starts the clock and binds the estate to one human.
        _checkIn(ALICE_COMMITMENT);

        // ASSERT — Active, and the countdown the dashboard reads is now real.
        assertEq(uint8(registry.statusOf(ESTATE_ID)), uint8(IHeritRegistry.Status.Active), "not active after check-in");
        (uint256 graceStartsAt, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);
        assertEq(graceStartsAt, block.timestamp + INTERVAL, "grace starts at the wrong time");
        assertEq(unlocksAt, block.timestamp + INTERVAL + GRACE, "unlocks at the wrong time");
        assertEq(attestor.commitmentOf(ESTATE_ID), ALICE_COMMITMENT, "estate bound to the wrong human");

        // ACT 2 — the window lapses with no check-in.
        vm.warp(graceStartsAt + 1);

        // ASSERT — Grace is computed, not stored, so it is true before anyone pokes.
        assertEq(uint8(registry.statusOf(ESTATE_ID)), uint8(IHeritRegistry.Status.Grace), "not in grace");
        assertFalse(gate.canClaim(ESTATE_ID, SON_LABEL, son), "heir could claim during grace");

        // ACT 3 — grace lapses too, and someone pokes.
        vm.warp(unlocksAt + 1);
        registry.pokeExpiry(ESTATE_ID);

        // ASSERT — the unlock did all three things it owes: status, ENS roles, vault snapshot.
        assertEq(uint8(registry.statusOf(ESTATE_ID)), uint8(IHeritRegistry.Status.Unlocked), "not unlocked");
        assertTrue(gate.canClaim(ESTATE_ID, SON_LABEL, son), "son cannot claim after unlock");
        assertTrue(gate.canClaim(ESTATE_ID, DAUGHTER_LABEL, daughter), "daughter cannot claim after unlock");
        assertTrue(vault.snapshotTaken(ESTATE_ID), "vault was never snapshotted");
        assertEq(vault.snapshotOf(ESTATE_ID, NATIVE), ETH_DEPOSIT, "eth snapshot is wrong");

        // ACT 4 — both heirs claim, each proving personhood with their own commitment.
        _claim(son, SON_LABEL, SON_HASH, SON_COMMITMENT);
        _claim(daughter, DAUGHTER_LABEL, DAUGHTER_HASH, DAUGHTER_COMMITMENT);

        // ASSERT — the money moved in the ratio the shares describe.
        assertEq(son.balance, ETH_DEPOSIT * SON_SHARE / 10_000, "son's eth is wrong");
        assertEq(daughter.balance, ETH_DEPOSIT * DAUGHTER_SHARE / 10_000, "daughter's eth is wrong");
        assertEq(usdc.balanceOf(son), USDC_DEPOSIT * SON_SHARE / 10_000, "son's usdc is wrong");
        assertEq(usdc.balanceOf(daughter), USDC_DEPOSIT * DAUGHTER_SHARE / 10_000, "daughter's usdc is wrong");

        // ASSERT — and the vault is empty, because the two shares sum to 100%.
        assertEq(vault.balanceOf(ESTATE_ID, NATIVE), 0, "eth left in the vault");
        assertEq(vault.balanceOf(ESTATE_ID, address(usdc)), 0, "usdc left in the vault");
    }

    /// @notice A wallet can find its own estates without an indexer, in both directions.
    /// @dev The two reverse indexes are the only reads keyed by address rather than estate id.
    function testWalletCanFindItsOwnEstates() public {
        // ARRANGE
        _openEstateWithHeirs();

        // ACT
        uint256[] memory opened = gate.estatesOfGrantor(alice);
        HeritRegistry.HeirSlot[] memory sonSlots = registry.heirSlotsOf(son);
        HeritRegistry.HeirSlot[] memory strangerSlots = registry.heirSlotsOf(stranger);

        // ASSERT
        assertEq(opened.length, 1, "grantor index missed the estate");
        assertEq(opened[0], ESTATE_ID, "grantor index has the wrong estate");

        assertEq(sonSlots.length, 1, "heir index missed the slot");
        assertEq(sonSlots[0].estateId, ESTATE_ID, "heir slot has the wrong estate");
        assertEq(sonSlots[0].heirLabelhash, SON_HASH, "heir slot has the wrong label");

        assertEq(strangerSlots.length, 0, "a stranger holds an heir slot");
    }

    /*//////////////////////////////////////////////////////////////
                          THE RECOVERY PATH
    //////////////////////////////////////////////////////////////*/

    /// @notice A grantor who checks in during grace goes back to Active. The false-alarm path.
    function testCheckInDuringGraceRecovers() public {
        // ARRANGE
        _openEstateWithHeirs();
        _checkIn(ALICE_COMMITMENT);
        (uint256 graceStartsAt,) = registry.deadlinesOf(ESTATE_ID);

        // ACT
        vm.warp(graceStartsAt + 1);
        assertEq(uint8(registry.statusOf(ESTATE_ID)), uint8(IHeritRegistry.Status.Grace), "not in grace");
        _checkIn(ALICE_COMMITMENT);

        // ASSERT
        assertEq(uint8(registry.statusOf(ESTATE_ID)), uint8(IHeritRegistry.Status.Active), "grace did not reverse");
        assertFalse(gate.canClaim(ESTATE_ID, SON_LABEL, son), "heir kept a claim role through recovery");
    }

    /// @notice Once unlocked, a check-in cannot take it back. The heirs' claim is not revocable.
    function testCheckInAfterUnlockReverts() public {
        // ARRANGE
        _openEstateWithHeirs();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);

        // ACT + ASSERT
        vm.warp(unlocksAt + 1);
        _checkInExpectingRevert(ALICE_COMMITMENT, "");
    }

    /*//////////////////////////////////////////////////////////////
                        THE WORLD ID GUARANTEES
    //////////////////////////////////////////////////////////////*/

    /// @notice The thesis: a stolen key cannot keep the estate sealed, because it is a different human.
    /// @dev The signature is valid and the caller is the real grantor address. Only the commitment
    ///      differs, and that alone is what stops the check-in.
    function testStolenKeyCannotCheckIn() public {
        // ARRANGE — alice checks in once, binding the estate to her.
        _openEstateWithHeirs();
        _checkIn(ALICE_COMMITMENT);

        // ACT + ASSERT — a thief holding her key passes a Selfie Check as themselves, and fails.
        _checkInExpectingRevert(
            THIEF_COMMITMENT, abi.encodeWithSelector(LivenessAttestor.LivenessAttestor__WrongHuman.selector, ESTATE_ID)
        );
    }

    /// @notice One human, one claim. A second heir slot cannot be drained by the same person.
    function testSameHumanCannotClaimTwice() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);
        vm.warp(unlocksAt + 1);
        registry.pokeExpiry(ESTATE_ID);
        _claim(son, SON_LABEL, SON_HASH, SON_COMMITMENT);

        // ACT + ASSERT — the daughter slot, claimed by the human who already took the son slot.
        _claimExpectingRevert(
            daughter,
            DAUGHTER_HASH,
            SON_COMMITMENT,
            abi.encodeWithSelector(
                LivenessAttestor.LivenessAttestor__CommitmentUsed.selector, ESTATE_ID, SON_COMMITMENT
            )
        );
    }

    /// @notice The grantor cannot also be an heir of their own estate.
    function testGrantorCannotClaimAsHeir() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);
        vm.warp(unlocksAt + 1);
        registry.pokeExpiry(ESTATE_ID);

        // ACT + ASSERT — same human as the one the estate's liveness is bound to.
        _claimExpectingRevert(
            son,
            SON_HASH,
            ALICE_COMMITMENT,
            abi.encodeWithSelector(LivenessAttestor.LivenessAttestor__WrongHuman.selector, ESTATE_ID)
        );
    }

    /// @notice A claim attestation cannot be spent as a check-in, or the reverse.
    function testClaimAttestationCannotCheckIn() public {
        // ARRANGE
        _openEstateWithHeirs();

        LivenessAttestor.Attestation memory a = LivenessAttestor.Attestation({
            estateId: ESTATE_ID,
            subject: alice,
            action: attestor.ACTION_CLAIM(),
            heirLabelhash: 0,
            commitment: ALICE_COMMITMENT,
            nonce: nextNonce++,
            expiry: block.timestamp + 10 minutes
        });

        // ACT + ASSERT
        bytes memory signature = _sign(a);
        bytes32 claimAction = attestor.ACTION_CLAIM();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LivenessAttestor.LivenessAttestor__WrongAction.selector, claimAction));
        attestor.checkIn(a, signature);
    }

    /// @notice An attestation is single use, even replayed by the person it was issued to.
    function testAttestationCannotBeReplayed() public {
        // ARRANGE
        _openEstateWithHeirs();
        LivenessAttestor.Attestation memory a = _attestation(alice, attestor.ACTION_CHECKIN(), 0, ALICE_COMMITMENT);
        bytes memory signature = _sign(a);
        vm.prank(alice);
        attestor.checkIn(a, signature);

        // ACT + ASSERT
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(LivenessAttestor.LivenessAttestor__NonceUsed.selector, a.nonce));
        attestor.checkIn(a, signature);
    }

    /// @notice Anyone can forge the struct; nobody can forge the signature.
    function testAttestationFromTheWrongSignerReverts() public {
        // ARRANGE
        _openEstateWithHeirs();
        (, uint256 wrongKey) = makeAddrAndKey("notTheAttestor");
        LivenessAttestor.Attestation memory a = _attestation(alice, attestor.ACTION_CHECKIN(), 0, ALICE_COMMITMENT);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            wrongKey,
            attestor.getMessageHash(a.estateId, a.subject, a.action, a.heirLabelhash, a.commitment, a.nonce, a.expiry)
        );

        // ACT + ASSERT
        vm.prank(alice);
        vm.expectRevert(LivenessAttestor.LivenessAttestor__InvalidSignature.selector);
        attestor.checkIn(a, abi.encodePacked(r, s, v));
    }

    /// @notice An attestation issued for alice cannot be spent by whoever relays it.
    function testAttestationIsBoundToItsSubject() public {
        // ARRANGE
        _openEstateWithHeirs();
        LivenessAttestor.Attestation memory a = _attestation(alice, attestor.ACTION_CHECKIN(), 0, ALICE_COMMITMENT);

        // ACT + ASSERT
        bytes memory signature = _sign(a);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(LivenessAttestor.LivenessAttestor__SubjectMismatch.selector, alice, stranger)
        );
        attestor.checkIn(a, signature);
    }

    /*//////////////////////////////////////////////////////////////
                            THE CLAIM GATE
    //////////////////////////////////////////////////////////////*/

    /// @notice No claim before unlock, however valid the attestation.
    function testHeirCannotClaimBeforeUnlock() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);

        // ACT + ASSERT
        _claimExpectingRevert(
            son,
            SON_HASH,
            SON_COMMITMENT,
            abi.encodeWithSelector(ClaimManager.ClaimManager__EstateNotUnlocked.selector, ESTATE_ID)
        );
    }

    /// @notice An heir can claim without anyone having poked first, because `claim` pokes itself.
    /// @dev Unlock is time-based but not automatic. Without the self-poke the ENS role would not
    ///      exist yet and this would revert `NotEntitled` — a confusing error for a valid claim.
    function testClaimWorksWithoutAnExplicitPoke() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);

        // ACT — no `pokeExpiry` anywhere.
        vm.warp(unlocksAt + 1);
        _claim(son, SON_LABEL, SON_HASH, SON_COMMITMENT);

        // ASSERT
        assertEq(son.balance, ETH_DEPOSIT * SON_SHARE / 10_000, "son was not paid");
    }

    /// @notice A stranger with a valid attestation still holds no ENS role, so they take nothing.
    function testStrangerCannotClaimAnHeirSlot() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);
        vm.warp(unlocksAt + 1);
        registry.pokeExpiry(ESTATE_ID);

        // ACT + ASSERT
        _claimExpectingRevert(
            stranger,
            SON_HASH,
            THIEF_COMMITMENT,
            abi.encodeWithSelector(ClaimManager.ClaimManager__NotEntitled.selector, ESTATE_ID, SON_HASH, stranger)
        );
    }

    /// @notice The vault is sealed at unlock, so a late deposit cannot dilute a claim mid-flight.
    function testDepositAfterUnlockReverts() public {
        // ARRANGE
        _openEstateWithHeirs();
        _fundVault();
        _checkIn(ALICE_COMMITMENT);
        (, uint256 unlocksAt) = registry.deadlinesOf(ESTATE_ID);
        vm.warp(unlocksAt + 1);
        registry.pokeExpiry(ESTATE_ID);

        // ACT + ASSERT
        vm.prank(alice);
        vm.expectRevert();
        vault.depositETH{value: 1 ether}(ESTATE_ID);
    }

    /*//////////////////////////////////////////////////////////////
                               HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Registry A and the resolver, the two Checkpoint 5 deployments this test recreates.
    function _deployEnsLayer() internal {
        IUserRegistryInit.RoleAssignment[] memory roles = new IUserRegistryInit.RoleAssignment[](1);
        roles[0] =
            IUserRegistryInit.RoleAssignment({account: address(this), roleBitmap: HeritRolesLib.GATE_ROOT_ROLE_BITMAP});
        registryA = IPermissionedRegistry(
            FACTORY.deployProxy(
                USER_REGISTRY_IMPL, REGISTRY_A_SALT, abi.encodeCall(IUserRegistryInit.initialize, (roles))
            )
        );

        IPermissionedResolverInit.RoleAssignment[] memory resolverRoles =
            new IPermissionedResolverInit.RoleAssignment[](1);
        resolverRoles[0] = IPermissionedResolverInit.RoleAssignment({
            account: address(this), roleBitmap: HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP
        });
        resolver = FACTORY.deployProxy(
            PERMISSIONED_RESOLVER_IMPL,
            RESOLVER_SALT,
            abi.encodeCall(IPermissionedResolverInit.initialize, (resolverRoles, new bytes[](0)))
        );
    }

    /// @dev The same nonce ring `script/DeployHerit.s.sol` uses, so this test also proves that
    ///      ordering works. Read the nonce immediately before, or an intervening `new` shifts it.
    function _deployHerit() internal {
        uint256 n = vm.getNonce(address(this));
        address pRegistry = vm.computeCreateAddress(address(this), n + 1);
        address pVault = vm.computeCreateAddress(address(this), n + 2);
        address pClaims = vm.computeCreateAddress(address(this), n + 3);
        address pAttestor = vm.computeCreateAddress(address(this), n + 4);

        gate = new AccessControlGate(FACTORY, USER_REGISTRY_IMPL, registryA, resolver, IHeritRegistry(pRegistry));
        registry = new HeritRegistry(registryA, gate, HeritVault(pVault), pAttestor);
        vault = new HeritVault(registryA, IHeritRegistry(address(registry)), pClaims);
        claims = new ClaimManager(registry, gate, vault, pAttestor);
        attestor = new LivenessAttestor(signer, registry, claims);

        assertEq(address(registry), pRegistry, "registry prediction missed");
        assertEq(address(vault), pVault, "vault prediction missed");
        assertEq(address(claims), pClaims, "claims prediction missed");
        assertEq(address(attestor), pAttestor, "attestor prediction missed");
    }

    /// @dev Estate setup: the grantor's name, two heir subnames, and the two timers.
    function _openEstateWithHeirs() internal {
        uint64 expiry = uint64(block.timestamp + 365 days);
        gate.openEstate(GRANTOR_LABEL, alice, expiry);

        vm.prank(alice);
        gate.registerHeir(ESTATE_ID, SON_LABEL, son, "son", SON_SHARE, expiry);
        vm.prank(alice);
        gate.registerHeir(ESTATE_ID, DAUGHTER_LABEL, daughter, "daughter", DAUGHTER_SHARE, expiry);

        vm.prank(alice);
        registry.configure(ESTATE_ID, INTERVAL, GRACE);
    }

    /// @dev ETH and one ERC20, both deposited by the grantor before unlock.
    function _fundVault() internal {
        vm.prank(alice);
        vault.depositETH{value: ETH_DEPOSIT}(ESTATE_ID);

        vm.startPrank(alice);
        usdc.approve(address(vault), USDC_DEPOSIT);
        vault.depositERC20(ESTATE_ID, address(usdc), USDC_DEPOSIT);
        vm.stopPrank();
    }

    /// @dev One Selfie Check, all the way through: backend signature, then the grantor's own tx.
    function _checkIn(bytes32 commitment) internal {
        LivenessAttestor.Attestation memory a = _attestation(alice, attestor.ACTION_CHECKIN(), 0, commitment);
        // Signed before the prank: `_sign` calls the attestor, and a prank only survives one call.
        bytes memory signature = _sign(a);
        vm.prank(alice);
        attestor.checkIn(a, signature);
    }

    /// @dev One heir claim, the same way round.
    function _claim(address heir, string memory, uint256 heirLabelhash, bytes32 commitment) internal {
        LivenessAttestor.Attestation memory a = _attestation(heir, attestor.ACTION_CLAIM(), heirLabelhash, commitment);
        bytes memory signature = _sign(a);
        vm.prank(heir);
        attestor.claim(a, signature);
    }

    /// @dev The negative form of `_checkIn`. Everything the attestation needs is built and signed
    ///      first, because `vm.expectRevert` binds to the very next external call — and reading
    ///      `ACTION_CHECKIN` is itself one. Pass empty bytes to accept any revert.
    function _checkInExpectingRevert(bytes32 commitment, bytes memory expectedError) internal {
        LivenessAttestor.Attestation memory a = _attestation(alice, attestor.ACTION_CHECKIN(), 0, commitment);
        bytes memory signature = _sign(a);

        if (expectedError.length == 0) {
            vm.expectRevert();
        } else {
            vm.expectRevert(expectedError);
        }
        vm.prank(alice);
        attestor.checkIn(a, signature);
    }

    /// @dev The negative form of `_claim`, for the same reason.
    function _claimExpectingRevert(address heir, uint256 heirLabelhash, bytes32 commitment, bytes memory expectedError)
        internal
    {
        LivenessAttestor.Attestation memory a = _attestation(heir, attestor.ACTION_CLAIM(), heirLabelhash, commitment);
        bytes memory signature = _sign(a);

        vm.expectRevert(expectedError);
        vm.prank(heir);
        attestor.claim(a, signature);
    }

    function _attestation(address subject, bytes32 action, uint256 heirLabelhash, bytes32 commitment)
        internal
        returns (LivenessAttestor.Attestation memory)
    {
        return LivenessAttestor.Attestation({
            estateId: ESTATE_ID,
            subject: subject,
            action: action,
            heirLabelhash: heirLabelhash,
            commitment: commitment,
            nonce: nextNonce++,
            expiry: block.timestamp + 10 minutes
        });
    }

    /// @dev What the Checkpoint 10 backend does with its attestor key, in one line.
    function _sign(LivenessAttestor.Attestation memory a) internal view returns (bytes memory) {
        bytes32 digest =
            attestor.getMessageHash(a.estateId, a.subject, a.action, a.heirLabelhash, a.commitment, a.nonce, a.expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
