// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import {CloneProxyBytecode} from "@ensdomains/verifiable-factory/CloneProxyBytecode.sol";

import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IUserRegistryInit} from "src/interfaces/IUserRegistryInit.sol";
import {IVerifiableFactoryLogic} from "src/interfaces/IVerifiableFactoryLogic.sol";

/// @title DeployRegistryA
/// @notice Deploys registry A — the `UserRegistry` that hangs under `herit.eth` and holds one name
///         per grantor — and attaches it as `herit.eth`'s subregistry. Checkpoint 5 of
///         `documents/build-plan.md`.
/// @dev Registry B is deployed per estate by `AccessControlGate.openEstate`, which initializes it
///      with the gate as its only root role holder. Registry A cannot work that way: the gate takes
///      registry A's address in its own constructor, so registry A has to exist first. The cycle is
///      broken by initializing registry A with the **deployer** as root holder, deploying the gate
///      against it, then granting the gate the same bitmap in a second transaction.
///
///      Why the deployer's bitmap is exactly `GATE_ROOT_ROLE_BITMAP` and not something larger:
///      `_getSettableRoles` is `withAdminRolesApplied(effectiveRoles)`, so an account can grant
///      precisely the regular roles whose admin halves it holds, plus those admin halves
///      themselves. Every regular role in `GATE_ROOT_ROLE_BITMAP` is paired with its admin, so
///      holding that bitmap is exactly the right to hand that bitmap on. Nothing wider is needed.
///
///      The deployer keeps its roles after `grantGate`. That is deliberate for a hackathon — it is
///      what lets you redeploy the gate and re-grant without redeploying registry A — but it does
///      mean the deployer stays a second root authority. `revokeRootRoles` closes it if wanted.
///
///      Order of operations:
///
///        forge script script/DeployRegistryA.s.sol --sig "deploy()" \
///          --rpc-url sepolia_eth --account herit-deployer --sender <your address> --broadcast
///        (deploy AccessControlGate with the printed registry A address)
///        forge script script/DeployRegistryA.s.sol --sig "grantGate(address)" <gate> \
///          --rpc-url sepolia_eth --account herit-deployer --sender <your address> --broadcast
///        forge script script/DeployRegistryA.s.sol --sig "check(address)" <gate> --rpc-url sepolia_eth
///
///      `--sender` is required, for the same reason it is in `RegisterHeritRoot`: `--account` only
///      decides who signs. Without `--sender`, `msg.sender` is Foundry's public default account,
///      and the root roles on registry A would be granted to a key anyone can spend from.
contract DeployRegistryA is Script {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set, from `documents/deployments.md`. Not the regular Sepolia beta set.
    IPermissionedRegistry internal constant ETH_REGISTRY =
        IPermissionedRegistry(0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e);
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);
    address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;

    string internal constant LABEL = "herit";

    /// @dev Domain-tagged and versioned. The factory namespaces salts by `msg.sender`, so this only
    ///      has to be unique among proxies the deployer EOA itself creates. Bump the suffix to
    ///      deploy a replacement registry A rather than colliding with this one.
    uint256 internal constant SALT = uint256(keccak256("herit.registry-a.v1"));

    /// @dev Foundry's default sender, used when `--sender` is omitted. Its private key is public.
    address internal constant FOUNDRY_DEFAULT_SENDER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Step one. Deploys registry A and attaches it under `herit.eth`.
    /// @return registryA The deployed proxy. Pass it to `AccessControlGate`'s constructor.
    function deploy() external returns (address registryA) {
        address deployer = _deployer();
        uint256 labelhash = uint256(keccak256(bytes(LABEL)));

        require(
            ETH_REGISTRY.getOwner(labelhash) == deployer, "herit.eth is not owned by --sender: run RegisterHeritRoot"
        );
        require(
            address(ETH_REGISTRY.getSubregistry(LABEL)) == address(0),
            "herit.eth already has a subregistry: run check()"
        );

        address predicted = _predict(deployer);
        console.log("deployer  ", deployer);
        console.log("predicted ", predicted);

        // One assignment: the deployer, holding exactly what it will later pass to the gate.
        IUserRegistryInit.RoleAssignment[] memory roles = new IUserRegistryInit.RoleAssignment[](1);
        roles[0] =
            IUserRegistryInit.RoleAssignment({account: deployer, roleBitmap: HeritRolesLib.GATE_ROOT_ROLE_BITMAP});

        vm.startBroadcast();
        registryA = FACTORY.deployProxy(USER_REGISTRY_IMPL, SALT, abi.encodeCall(IUserRegistryInit.initialize, (roles)));
        // The proxy is created and initialized in one call, so there is no window in which an
        // uninitialized registry sits on-chain for someone else to claim root roles on.

        ETH_REGISTRY.setSubregistry(labelhash, IRegistry(registryA));
        // `herit.eth` now resolves one level deeper. Every grantor name the gate issues lives here.
        vm.stopBroadcast();

        require(registryA == predicted, "deployed address does not match prediction: check SALT and factory");
        console.log("registryA ", registryA);
        console.log("next: deploy AccessControlGate with this address, then run grantGate(address)");
    }

    /// @notice Step two. Hands the gate the root roles that make every later ENS call possible.
    /// @param gate The deployed `AccessControlGate`.
    /// @dev This is the grant the gate's own constructor documentation asks for. `ROLE_REGISTRAR`
    ///      lets it issue grantor names; `ROLE_RENEW` at root is also what `renewEstate` needs to
    ///      revive an already-lapsed grantor name, since `PermissionedRegistry.renew` takes the
    ///      `_canRevive` path there and checks `hasRootRoles(ROLE_RENEW, sender)`.
    function grantGate(address gate) external {
        address deployer = _deployer();
        require(gate != address(0), "gate is the zero address");
        require(gate.code.length != 0, "gate has no code: wrong address or not deployed yet");

        address registryA = address(ETH_REGISTRY.getSubregistry(LABEL));
        require(registryA != address(0), "herit.eth has no subregistry: run deploy() first");

        console.log("registryA ", registryA);
        console.log("gate      ", gate);
        console.log("deployer  ", deployer);

        vm.startBroadcast();
        IPermissionedRegistry(registryA).grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, gate);
        vm.stopBroadcast();

        console.log("granted GATE_ROOT_ROLE_BITMAP", HeritRolesLib.GATE_ROOT_ROLE_BITMAP);
    }

    /// @notice Read-only confirmation that registry A is attached and the gate can act on it.
    /// @param gate The deployed `AccessControlGate`, or the zero address to skip the role check.
    function check(address gate) external view {
        address registryA = address(ETH_REGISTRY.getSubregistry(LABEL));
        console.log("herit.eth owner      ", ETH_REGISTRY.getOwner(uint256(keccak256(bytes(LABEL)))));
        console.log("herit.eth subregistry", registryA);

        if (registryA == address(0)) {
            console.log("not deployed yet");
            return;
        }

        console.log("implementation       ", FACTORY.verifyContract(registryA));
        // Reverts `VerificationFailed` if the proxy was not made by this factory, which is the
        // check that makes the factory "verifiable": the address alone proves its provenance.

        if (gate != address(0)) {
            bool ok = IPermissionedRegistry(registryA).hasRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, gate);
            console.log("gate has root roles  ", ok);
            // `hasRootRoles` requires the whole bitmap, so false means at least one bit is missing,
            // not necessarily that nothing was granted.
        }
    }

    /// @notice The address `deploy()` will produce, before it is called.
    /// @param deployer The EOA that will run `deploy()`, i.e. whatever `--sender` says.
    function predict(address deployer) external view returns (address) {
        return _predict(deployer);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Same arithmetic as `AccessControlGate.predictEstateRegistry`, with the deployer EOA as
    ///      the caller instead of the gate. The factory hashes the caller into the salt, which is
    ///      what stops two callers who pick the same salt from colliding, and appends the result to
    ///      the clone's runtime so it can verify the proxy later — hence the salt appearing twice.
    function _predict(address deployer) internal view returns (address) {
        bytes32 outerSalt = keccak256(abi.encode(deployer, SALT));
        address logic = IVerifiableFactoryLogic(address(FACTORY)).proxyLogic();
        return Create2.computeAddress(
            outerSalt, keccak256(CloneProxyBytecode.creationCode(logic, outerSalt)), address(FACTORY)
        );
    }

    /// @dev `--account` chooses the signer; `--sender` sets `msg.sender`. Refusing the default is
    ///      the difference between the deployer holding registry A's root roles and publishing them.
    function _deployer() internal view returns (address deployer) {
        deployer = msg.sender;
        require(
            deployer != FOUNDRY_DEFAULT_SENDER,
            "msg.sender is Foundry's default account (public key): pass --sender <your address>"
        );
    }
}
