// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IETHRegistrar} from "@ensdomains/contracts-v2/registrar/interfaces/IETHRegistrar.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

/// @title RegisterHeritRoot
/// @notice Registers `herit.eth` on the frozen ENSv2 hackathon deployment. Herit issues every
///         grantor name as a subname of this one, so this is the only `.eth` registration the
///         project ever makes.
/// @dev Registration is commit-reveal with a mandatory 60 second gap, which no single broadcast
///      can span. Run `commit` first, wait, then run `reveal`. The secret is derived from
///      `HERIT_SECRET` so both runs agree without you copying a hash between them.
///
///      Addresses are the frozen hackathon set from `documents/deployments.md`. The regular
///      Sepolia beta set is a different group of contracts, and a name registered there would be
///      invisible to Herit.
///
///      `--sender` is required. Without it `msg.sender` is Foundry's default account, whose
///      private key is public, and the name would register to an address anyone can spend from.
///      `--account` only decides who signs; it does not set `msg.sender`.
///
///      export HERIT_SECRET='...'
///      forge script script/RegisterHeritRoot.s.sol --sig "commit()" \
///        --rpc-url sepolia_eth --account herit-deployer --sender <your address> --broadcast
///      (wait 60 seconds)
///      forge script script/RegisterHeritRoot.s.sol --sig "reveal()" \
///        --rpc-url sepolia_eth --account herit-deployer --sender <your address> --broadcast
///      forge script script/RegisterHeritRoot.s.sol --sig "check()" --rpc-url sepolia_eth
contract RegisterHeritRoot is Script {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    IETHRegistrar internal constant REGISTRAR = IETHRegistrar(0x7d1B7f586a62Ac3F54b9A396849757814283270b);
    IPermissionedRegistry internal constant ETH_REGISTRY =
        IPermissionedRegistry(0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e);
    IERC20 internal constant MOCK_USDC = IERC20(0xcBFD80F74375c54E545AF34788Ff465F96F66F05);

    string internal constant LABEL = "herit";
    uint64 internal constant DURATION = 365 days;
    uint256 internal constant MINT_AMOUNT = 100e6; // MockUSDC has 6 decimals
    bytes32 internal constant REFERRER = bytes32(0);

    /// @dev Foundry's default sender, used when `--sender` is omitted. Its private key is public,
    ///      so a name registered to it is a name anyone can take.
    address internal constant FOUNDRY_DEFAULT_SENDER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

    /// @dev Attached at Checkpoint 5, once the grantor registry proxy exists.
    IRegistry internal constant SUBREGISTRY = IRegistry(address(0));
    /// @dev Set later, alongside the grantor registry.
    address internal constant RESOLVER = address(0);

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Step one. Mints the test payment token, approves the registrar, and records the
    ///         commitment. Wait 60 seconds before `reveal`.
    function commit() external {
        address owner = _owner();
        bytes32 commitment = _commitment(owner);

        console.log("owner     ", owner);
        console.log("label     ", LABEL);
        console.log("available ", REGISTRAR.isAvailable(LABEL));
        (uint256 base, uint256 premium) = REGISTRAR.getRegisterPrice(LABEL, DURATION, MOCK_USDC);
        console.log("price     ", base + premium);

        vm.startBroadcast();
        (bool minted,) = address(MOCK_USDC).call(abi.encodeWithSignature("mint(address,uint256)", owner, MINT_AMOUNT));
        require(minted, "MockUSDC mint failed");
        MOCK_USDC.approve(address(REGISTRAR), MINT_AMOUNT);
        REGISTRAR.commit(commitment);
        vm.stopBroadcast();

        console.log("committed. wait 60 seconds, then run reveal()");
    }

    /// @notice Step two. Registers the name against the commitment made above.
    function reveal() external {
        address owner = _owner();
        uint64 committedAt = REGISTRAR.commitmentAt(_commitment(owner));
        require(committedAt != 0, "no commitment: run commit() first, with the same HERIT_SECRET");
        require(block.timestamp >= committedAt + 60, "commitment too young: wait out the 60s");

        (uint256 base, uint256 premium) = REGISTRAR.getRegisterPrice(LABEL, DURATION, MOCK_USDC);
        require(MOCK_USDC.balanceOf(owner) >= base + premium, "not enough MockUSDC: re-run commit()");

        vm.startBroadcast();
        uint256 tokenId =
            REGISTRAR.register(LABEL, owner, _secret(), SUBREGISTRY, RESOLVER, DURATION, MOCK_USDC, REFERRER);
        vm.stopBroadcast();

        console.log("registered, tokenId", tokenId);
    }

    /// @notice Read-only confirmation that the name is registered and owned by `msg.sender`.
    function check() external view {
        IPermissionedRegistry.State memory state = ETH_REGISTRY.getState(uint256(keccak256(bytes(LABEL))));
        console.log("status (2 = REGISTERED)", uint256(state.status));
        console.log("owner                  ", state.latestOwner);
        console.log("expiry                 ", state.expiry);
        console.log("still available        ", REGISTRAR.isAvailable(LABEL));
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev `msg.sender` in a script is whatever `--sender` says, and Foundry's public default
    ///      account when `--sender` is omitted. `--account` only chooses the signer. Refusing the
    ///      default is the difference between owning the name and publishing it.
    function _owner() internal view returns (address owner) {
        owner = msg.sender;
        require(
            owner != FOUNDRY_DEFAULT_SENDER,
            "msg.sender is Foundry's default account (public key): pass --sender <your address>"
        );
    }

    /// @dev Derived from `HERIT_SECRET` so `commit` and `reveal` agree across two separate runs.
    function _secret() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(vm.envString("HERIT_SECRET")));
    }

    function _commitment(address owner) internal view returns (bytes32) {
        return REGISTRAR.makeCommitment(LABEL, owner, _secret(), SUBREGISTRY, RESOLVER, DURATION, REFERRER);
    }
}
