// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import {CloneProxyBytecode} from "@ensdomains/verifiable-factory/CloneProxyBytecode.sol";
import {IEnhancedAccessControl} from "@ensdomains/contracts-v2/access-control/interfaces/IEnhancedAccessControl.sol";

import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IPermissionedResolverInit} from "src/interfaces/IPermissionedResolverInit.sol";
import {IVerifiableFactoryLogic} from "src/interfaces/IVerifiableFactoryLogic.sol";

/// @title DeployResolver
/// @notice Deploys the `PermissionedResolver` that holds every heir's `addr`,
///         `herit.relationship` and `herit.share` records, and grants `AccessControlGate` the
///         roles it needs to write them. Checkpoint 5 of `documents/build-plan.md`, alongside
///         `DeployRegistryA`.
/// @dev One resolver serves every estate. `EnhancedAccessControl` grants on ROOT_RESOURCE fall
///      through to every resource, so a single `grantRootRoles` here covers every heir name under
///      every grantor, forever. Confirmed on a Sepolia fork by
///      `test/unit/HeritForkTest.t.sol:testHeirRecordsReadBackFromTheRealResolver`.
///
///      Same bootstrap problem as registry A, same fix: the gate takes the resolver's address as
///      an immutable, so the resolver has to exist first. It is initialized with the **deployer**
///      holding `GATE_RESOLVER_ROLE_BITMAP`, and the gate is granted the same bitmap afterwards.
///      That bitmap includes the `_ADMIN` halves precisely so this hand-over is possible —
///      `_getSettableRoles` permits granting only the roles whose admin halves you hold, and
///      without them `grantGate` reverts `EACCannotGrantRoles(0, 17, deployer)`.
///
///      The deployer keeps its roles afterwards, deliberately, so the gate can be redeployed and
///      re-granted without redeploying the resolver. `revokeRootRoles` closes that if wanted.
///
///      **Full Checkpoint 5 order.** Three deploys and two grants, because the gate sits in the
///      middle of both cycles:
///
///        # 1. the resolver (this script)
///        forge script script/DeployResolver.s.sol --sig "deploy()" \
///          --rpc-url sepolia_eth --account herit-deployer --sender $HERIT_OWNER --broadcast
///
///        # 2. registry A, attached under herit.eth
///        forge script script/DeployRegistryA.s.sol --sig "deploy()" \
///          --rpc-url sepolia_eth --account herit-deployer --sender $HERIT_OWNER --broadcast
///
///        # 3. the gate, against both addresses. No script: its constructor is five arguments and
///        #    `DeployHerit.s.sol` at Checkpoint 8 will supersede anything written for it now.
///        forge create src/AccessControlGate.sol:AccessControlGate \
///          --rpc-url sepolia_eth --account herit-deployer --broadcast \
///          --constructor-args 0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780 \
///                             0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546 \
///                             <registryA> <resolver> <heritRegistry>
///
///        # 4. and 5. hand the gate its roles on each
///        forge script script/DeployRegistryA.s.sol --sig "grantGate(address)" <gate> \
///          --rpc-url sepolia_eth --account herit-deployer --sender $HERIT_OWNER --broadcast
///        forge script script/DeployResolver.s.sol --sig "grantGate(address)" <gate> \
///          --rpc-url sepolia_eth --account herit-deployer --sender $HERIT_OWNER --broadcast
///
///        # then, read-only
///        forge script script/DeployResolver.s.sol --sig "check(address)" <gate> --rpc-url sepolia_eth
///
///      **On the gate's `heritRegistry` argument at step 3.** `HeritRegistry` does not exist yet,
///      and every gate field is `immutable`, so whatever is passed now is permanent for that
///      deployment. Pass your own EOA: `unlockHeir` is then callable by you, which is exactly what
///      the Checkpoint 5 `cast` walkthrough needs. This gate is a throwaway for proving the ENS
///      mechanic. Checkpoint 8 redeploys it with the real `HeritRegistry` address, and registry A
///      and this resolver both survive that — only `grantGate` has to be re-run for the new gate.
contract DeployResolver is Script {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set, from `documents/deployments.md`. Not the regular Sepolia beta set.
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);

    /// @dev Name-based setters only; the copy in `lib/` is older and uses namehashes.
    address internal constant PERMISSIONED_RESOLVER_IMPL = 0xa9d3814AB151BF6E37A427432795371a8361614e;

    /// @dev Domain-tagged and versioned, like registry A's. The factory namespaces salts by
    ///      `msg.sender`, so this only has to be unique among proxies this deployer creates. Bump
    ///      the suffix to deploy a replacement rather than colliding with this one.
    uint256 internal constant SALT = uint256(keccak256("herit.resolver.v1"));

    /// @dev Foundry's default sender, used when `--sender` is omitted. Its private key is public.
    address internal constant FOUNDRY_DEFAULT_SENDER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Step one. Deploys the resolver proxy with the deployer holding its root roles.
    /// @return resolver The deployed proxy. Pass it to `AccessControlGate`'s constructor.
    function deploy() external returns (address resolver) {
        address deployer = _deployer();
        address predicted = _predict(deployer);

        require(predicted.code.length == 0, "a resolver already exists at this salt: run check()");

        console.log("deployer  ", deployer);
        console.log("predicted ", predicted);

        // One assignment: the deployer, holding exactly what it will later pass to the gate.
        IPermissionedResolverInit.RoleAssignment[] memory roles = new IPermissionedResolverInit.RoleAssignment[](1);
        roles[0] = IPermissionedResolverInit.RoleAssignment({
            account: deployer, roleBitmap: HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP
        });

        vm.startBroadcast();
        // The proxy is created and initialized in one call, so no uninitialized resolver ever sits
        // on-chain for someone else to claim root roles on. The empty `bytes[]` is what the gate
        // needs; the argument's wider purpose is unestablished, see `IPermissionedResolverInit`.
        resolver = FACTORY.deployProxy(
            PERMISSIONED_RESOLVER_IMPL,
            SALT,
            abi.encodeCall(IPermissionedResolverInit.initialize, (roles, new bytes[](0)))
        );
        vm.stopBroadcast();

        require(resolver == predicted, "deployed address does not match prediction: check SALT and factory");
        console.log("resolver  ", resolver);
        console.log("next: deploy registry A, then the gate with both addresses, then grantGate(address)");
    }

    /// @notice Step two, after the gate is deployed. Lets it write heir records.
    /// @param gate The deployed `AccessControlGate`.
    function grantGate(address gate) external {
        address deployer = _deployer();
        require(gate != address(0), "gate is the zero address");
        require(gate.code.length != 0, "gate has no code: wrong address or not deployed yet");

        address resolver = _predict(deployer);
        require(resolver.code.length != 0, "no resolver at this salt: run deploy() first");

        console.log("resolver  ", resolver);
        console.log("gate      ", gate);
        console.log("deployer  ", deployer);

        vm.startBroadcast();
        IEnhancedAccessControl(resolver).grantRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, gate);
        vm.stopBroadcast();

        console.log("granted GATE_RESOLVER_ROLE_BITMAP", HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP);
    }

    /// @notice Read-only confirmation that the resolver exists and the gate can write to it.
    /// @param gate The deployed `AccessControlGate`, or the zero address to skip the role check.
    /// @dev Takes the deployer as `--sender` like the others, because the resolver's address is
    ///      derived from whoever deployed it.
    function check(address gate) external view {
        address resolver = _predict(msg.sender);
        console.log("resolver  ", resolver);

        if (resolver.code.length == 0) {
            console.log("not deployed yet");
            return;
        }

        // Reverts `VerificationFailed` if this proxy was not made by this factory, which is what
        // makes the factory "verifiable": the address alone proves where it came from.
        console.log("implementation", FACTORY.verifyContract(resolver));

        if (gate != address(0)) {
            bool ok = IEnhancedAccessControl(resolver).hasRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, gate);
            console.log("gate can write records", ok);
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

    /// @dev Identical arithmetic to `DeployRegistryA._predict`, differing only in the salt. The
    ///      factory hashes the caller into the salt, which stops two callers who pick the same
    ///      salt from colliding, and appends the result to the clone's runtime so it can verify
    ///      the proxy later — which is why the salt appears twice.
    function _predict(address deployer) internal view returns (address) {
        bytes32 outerSalt = keccak256(abi.encode(deployer, SALT));
        address logic = IVerifiableFactoryLogic(address(FACTORY)).proxyLogic();
        return Create2.computeAddress(
            outerSalt, keccak256(CloneProxyBytecode.creationCode(logic, outerSalt)), address(FACTORY)
        );
    }

    /// @dev `--account` chooses the signer; `--sender` sets `msg.sender`. Refusing the default is
    ///      the difference between the deployer holding the resolver's root roles and publishing
    ///      them.
    function _deployer() internal view returns (address deployer) {
        deployer = msg.sender;
        require(
            deployer != FOUNDRY_DEFAULT_SENDER,
            "msg.sender is Foundry's default account (public key): pass --sender <your address>"
        );
    }
}
