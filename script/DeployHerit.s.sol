// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

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

/// @title DeployHerit
/// @notice Deploys the five Herit contracts in one transaction sequence and re-grants the gate its
///         ENS roles. Checkpoint 9.5 of `documents/build-plan.md`.
/// @dev Every dependency between the five is `immutable` and they need each other in a ring, so
///      none of them can be deployed on its own. CREATE2 does not open it — a CREATE2 address
///      depends on the creation code, which carries the constructor arguments, so predicting the
///      vault would need the registry's address and vice versa. Plain `CREATE` does open it: an
///      address is only `keccak256(rlp(deployer, nonce))` and the arguments are not in it. So all
///      five addresses are computed from the deployer's nonce before anything is deployed.
///
///      This works only if the deployer sends exactly these transactions, in this order, with
///      nothing else spending its nonces in between. Run `predict(address)` first, and check
///      nothing else holds the key.
///
///        make predict-herit
///        make deploy-herit-dry     # against a fork, free
///        make deploy-herit
///        make check-herit ATTESTOR=0x...
contract DeployHerit is Script {
    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    struct Deployed {
        address gate;
        address registry;
        address vault;
        address claims;
        address attestor;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set and Checkpoint 5's own deployments, from `documents/deployments.md`.
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);
    address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;
    IPermissionedRegistry internal constant REGISTRY_A =
        IPermissionedRegistry(0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21);
    address internal constant RESOLVER = 0x42fA2a1582a89E18d0a54d8dC65157172489EBb1;

    /// @dev Foundry's default sender, used when `--sender` is omitted. Its private key is public.
    address internal constant FOUNDRY_DEFAULT_SENDER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploys all five, then hands the new gate its two sets of ENS root roles.
    function deploy() external returns (Deployed memory d) {
        address deployer = _deployer();
        address signer = _signer();

        require(
            REGISTRY_A.hasRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, deployer),
            "deployer lacks registry A root roles: the grants at the end would revert"
        );
        require(
            IEnhancedAccessControl(RESOLVER).hasRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, deployer),
            "deployer lacks resolver root roles: the grants at the end would revert"
        );

        Deployed memory p = _predict(deployer);
        _log("predicted", p);
        console.log("signer     ", signer);

        vm.startBroadcast();

        AccessControlGate gate =
            new AccessControlGate(FACTORY, USER_REGISTRY_IMPL, REGISTRY_A, RESOLVER, IHeritRegistry(p.registry));
        require(address(gate) == p.gate, "nonce prediction missed: gate");

        HeritRegistry registry = new HeritRegistry(REGISTRY_A, gate, HeritVault(p.vault), p.attestor);
        require(address(registry) == p.registry, "nonce prediction missed: registry");

        HeritVault vault = new HeritVault(REGISTRY_A, IHeritRegistry(address(registry)), p.claims);
        require(address(vault) == p.vault, "nonce prediction missed: vault");

        ClaimManager claims = new ClaimManager(registry, gate, vault, p.attestor);
        require(address(claims) == p.claims, "nonce prediction missed: claims");

        LivenessAttestor attestor = new LivenessAttestor(signer, registry, claims);
        require(address(attestor) == p.attestor, "nonce prediction missed: attestor");

        // The gate is new, so the two Checkpoint 5 grants are re-run against it. Registry A, the
        // resolver and `herit.eth` are untouched — none of them holds a reference to any gate.
        REGISTRY_A.grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(gate));
        IEnhancedAccessControl(RESOLVER).grantRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, address(gate));

        vm.stopBroadcast();

        d = p;
        _log("deployed", d);
        console.log("next: record these in documents/deployments.md, then run check(address attestor)");
    }

    /// @notice The five addresses `deploy()` will produce, before it is called.
    /// @param deployer The EOA that will run `deploy()`, i.e. whatever `--sender` says.
    function predict(address deployer) external view returns (Deployed memory d) {
        d = _predict(deployer);
        _log("predicted", d);
    }

    /// @notice Reads the whole ring back and asserts every pair agrees about the other.
    /// @param attestor The deployed `LivenessAttestor`. The other four are reached through it.
    /// @dev One argument, not five: the attestor names the registry and the claim manager, and the
    ///      registry names the gate and the vault. Walking it is itself part of the test — a ring
    ///      that cannot be walked is a ring that is already wrong.
    function check(address attestor) external view {
        require(attestor.code.length != 0, "attestor has no code: wrong address or not deployed");

        HeritRegistry registry = LivenessAttestor(attestor).I_HERIT_REGISTRY();
        ClaimManager claims = LivenessAttestor(attestor).I_CLAIM_MANAGER();
        AccessControlGate gate = registry.I_GATE();
        HeritVault vault = registry.I_VAULT();

        _log("found", Deployed(address(gate), address(registry), address(vault), address(claims), attestor));

        // The ring, in both directions.
        require(address(gate.I_HERIT_REGISTRY()) == address(registry), "gate -> registry");
        require(registry.I_ATTESTOR() == attestor, "registry -> attestor");
        require(address(vault.I_HERIT_REGISTRY()) == address(registry), "vault -> registry");
        require(vault.I_CLAIM_MANAGER() == address(claims), "vault -> claims");
        require(address(claims.I_HERIT_REGISTRY()) == address(registry), "claims -> registry");
        require(address(claims.I_GATE()) == address(gate), "claims -> gate");
        require(address(claims.I_VAULT()) == address(vault), "claims -> vault");
        require(claims.I_ATTESTOR() == attestor, "claims -> attestor");

        // The three that are not ours, and must be Checkpoint 5's.
        require(address(registry.I_GRANTOR_REGISTRY()) == address(REGISTRY_A), "registry -> registry A");
        require(address(vault.I_GRANTOR_REGISTRY()) == address(REGISTRY_A), "vault -> registry A");
        require(address(gate.I_GRANTOR_REGISTRY()) == address(REGISTRY_A), "gate -> registry A");
        require(gate.I_RESOLVER() == RESOLVER, "gate -> resolver");

        // Without these the gate is deployed but powerless, and openEstate reverts on the first call.
        require(
            REGISTRY_A.hasRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(gate)), "gate lacks registry A roles"
        );
        require(
            IEnhancedAccessControl(RESOLVER).hasRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, address(gate)),
            "gate lacks resolver roles"
        );

        console.log("attestor signer", LivenessAttestor(attestor).I_SIGNER());
        console.log("all checks passed");
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Five consecutive nonces from wherever the deployer is now. Nothing else may spend one
    ///      in between, or every address below shifts and the requires in `deploy()` fire.
    function _predict(address deployer) internal view returns (Deployed memory d) {
        uint256 n = vm.getNonce(deployer);
        d.gate = vm.computeCreateAddress(deployer, n);
        d.registry = vm.computeCreateAddress(deployer, n + 1);
        d.vault = vm.computeCreateAddress(deployer, n + 2);
        d.claims = vm.computeCreateAddress(deployer, n + 3);
        d.attestor = vm.computeCreateAddress(deployer, n + 4);
    }

    /// @dev The backend's attestor key, from Checkpoint 10. It changes while that is being built,
    ///      and it is `immutable` once deployed, so it is read from the environment rather than
    ///      hardcoded — a wrong one here means redeploying all five.
    function _signer() internal view returns (address signer) {
        signer = vm.envOr("HERIT_ATTESTOR_SIGNER", address(0));
        require(signer != address(0), "HERIT_ATTESTOR_SIGNER is unset: export the backend's attestor address");
    }

    /// @dev `--account` chooses the signer; `--sender` sets `msg.sender`. Foundry infers neither
    ///      from the other, and the default account's private key is public.
    function _deployer() internal view returns (address deployer) {
        deployer = msg.sender;
        require(
            deployer != FOUNDRY_DEFAULT_SENDER,
            "msg.sender is Foundry's default account (public key): pass --sender <your address>"
        );
    }

    function _log(string memory what, Deployed memory d) internal pure {
        console.log(what);
        console.log("  gate    ", d.gate);
        console.log("  registry", d.registry);
        console.log("  vault   ", d.vault);
        console.log("  claims  ", d.claims);
        console.log("  attestor", d.attestor);
    }
}
