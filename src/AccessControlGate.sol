// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

import {HeritRolesLib} from "./libraries/HeritRolesLib.sol";

/// @title AccessControlGate
/// @notice The only contract in Herit that talks to ENS. Everything else deals in money and time;
///         this deals in names and permissions, and translates between the two.
/// @dev Hierarchy it maintains:
///
///      herit.eth                     owned by the deployer EOA
///        └─ GRANTOR_REGISTRY         registry A, this contract holds root roles
///             └─ alice               a grantor, owns the name
///                  └─ estate registry   registry B, deployed per estate, this contract holds root
///                       ├─ son          an heir
///                       └─ kate         an heir
///
///      The gate never holds funds and never decides when an estate unlocks. `HeritRegistry` owns
///      that decision and calls in. The gate holds `ROLE_HEIR_CLAIM_ADMIN` on every registry root,
///      which is the most dangerous privilege in the system, so every state-changing function here
///      needs an access check.
contract AccessControlGate {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error AccessControlGate__ZeroAddress();
    error AccessControlGate__NotHeritRegistry();
    error AccessControlGate__NotGrantor();
    error AccessControlGate__EstateNotFound(uint256 estateId);
    error AccessControlGate__LabelNotAvailable(string label);

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev The deployed `UserRegistryImpl` takes an array of these, unlike the pinned submodule
    ///      which takes `(address,uint256)`. See `documents/deployments.md`.
    ///      Selector: `initialize((address,uint256)[])` = `0x37cb53a8`.
    struct RoleAssignment {
        address account;
        uint256 roleBitmap;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // TODO immutables, all set in the constructor:
    //   VERIFIABLE_FACTORY   deploys a UserRegistry proxy per estate
    //   USER_REGISTRY_IMPL   the implementation those proxies point at
    //   GRANTOR_REGISTRY     registry A, where grantor labels live
    //   RESOLVER             the resolver that holds heir text records
    //   HERIT_REGISTRY       the state machine, and the only address allowed to unlock
    //
    // TODO storage:
    //   mapping(uint256 estateId => address estateRegistry)
    //
    // Deliberately NOT stored: the grantor's address. `GRANTOR_REGISTRY.getOwner(estateId)`
    // already knows it, and a second copy is a second thing that can go stale.

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    // TODO EstateOpened(estateId, grantor, estateRegistry, label)
    // TODO HeirRegistered(estateId, heirLabelhash, heir, shareBps)
    // TODO HeirUnlocked(estateId, heirLabelhash, heir)
    //
    // The demo video reads these. Index what you will filter on.

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    // TODO onlyHeritRegistry  — guards unlockHeir. Without it anyone grants themselves the claim
    //                           role and drains an estate.
    // TODO onlyGrantorOf(estateId) — guards registerHeir, reading the owner from GRANTOR_REGISTRY.

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    // TODO take the five addresses above, revert on any zero.
    //
    // Ordering problem to solve: HeritRegistry needs the gate's address and the gate needs
    // HeritRegistry's. Options are a two-step setter locked after first use, or deploying one
    // with a CREATE2 address computed in advance. Pick one and say why in a comment.

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Onboards a grantor: gives them `label.herit.eth` and its own empty heir registry.
    /// @param label The grantor's label, e.g. "alice".
    /// @param grantor The address that will own the name.
    /// @return estateRegistry The registry deployed for this estate.
    function openEstate(string calldata label, address grantor) external returns (address estateRegistry) {
        // 1. estateId = uint256(keccak256(bytes(label)))
        //
        // 2. Require the label is free in GRANTOR_REGISTRY:
        //    getStatus(estateId) == IPermissionedRegistry.Status.AVAILABLE
        //
        // 3. Deploy registry B through the factory:
        //      initData = abi.encodeCall(initialize, ([RoleAssignment(address(this),
        //                                              HeritRolesLib.GATE_ROOT_ROLE_BITMAP)]))
        //      estateRegistry = VERIFIABLE_FACTORY.deployProxy(USER_REGISTRY_IMPL, salt, initData)
        //    Derive `salt` from estateId so the address is reproducible.
        //
        // 4. Register the grantor's name in registry A, pointing at registry B:
        //      GRANTOR_REGISTRY.register(label, grantor, IRegistry(estateRegistry),
        //                                RESOLVER, <bitmap>, <expiry>)
        //
        //    Think hard about <bitmap>. If the grantor holds ROLE_SET_SUBREGISTRY they can swap
        //    registry B for one they control, and with it every heir role. Withholding it means
        //    the estate structure is fixed once opened, which is arguably the point of a will.
        //
        //    <expiry> must outlast the demo. A role cannot be granted on an expired name.
        //
        // 5. Record estateRegistry against estateId, and emit.
    }

    /// @notice Adds an heir to an estate as a subname, with the claim role withheld.
    /// @param estateId The grantor label hash.
    /// @param label The heir's label, e.g. "son".
    /// @param heir The address that will own the heir subname.
    /// @param relationship Free text written to the `herit.relationship` record.
    /// @param shareBps The heir's share in basis points, written to `herit.share`.
    function registerHeir(
        uint256 estateId,
        string calldata label,
        address heir,
        string calldata relationship,
        uint16 shareBps
    ) external {
        // 1. Look up the estate registry, revert if unknown.
        //
        // 2. Access check. Decide who may add heirs: the grantor directly, or HeritRegistry so the
        //    share matrix and the ENS records can never disagree. Whichever you choose, the two
        //    must stay in step — a share recorded here but not there is a silent bug.
        //
        // 3. Register into registry B, not registry A:
        //      register(label, heir, IRegistry(address(0)), RESOLVER,
        //               HeritRolesLib.HEIR_REGISTRATION_ROLE_BITMAP, <expiry>)
        //
        //    That bitmap withholds ROLE_HEIR_CLAIM on purpose. Granting it later is the unlock.
        //
        // 4. Write the records through RESOLVER:
        //      setText(node, "herit.relationship", relationship)
        //      setText(node, "herit.share", <shareBps as string>)
        //
        //    GOTCHA: the resolver keys off `node`, the namehash of the FULL name
        //    ("son.alice.herit.eth"), while the registry keys off `labelhash("son")`. They are
        //    different values. Mixing them up writes records nobody can read.
        //
        // 5. Emit.
    }

    /// @notice Grants an heir the claim role. Called by `HeritRegistry` when an estate unlocks.
    /// @param estateId The grantor label hash.
    /// @param label The heir's label.
    /// @param heir The heir address receiving the role.
    function unlockHeir(uint256 estateId, string calldata label, address heir) external {
        // 1. onlyHeritRegistry.
        //
        // 2. Look up the estate registry.
        //
        // 3. Optional but worth it: if the heir subname is near expiry, renew first. A role cannot
        //    be granted on an expired name, and an unlock that arrives late would otherwise fail.
        //
        // 4. registry.grantRoles(labelhash(label), HeritRolesLib.ROLE_HEIR_CLAIM, heir)
        //
        //    This is the whole inheritance, in one call, in the real ENS registry.
        //    Side effect to remember: this burns and re-mints the heir's subname token, so its
        //    token id changes. Never cache one.
        //
        // 5. Emit.
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    // TODO _estateRegistry(estateId) — lookup plus the not-found revert, used by all three above.
    // TODO _labelhash(label) — uint256(keccak256(bytes(label))), so the cast appears once.

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Whether an heir may claim. Read by `ClaimManager`.
    /// @dev Answers from ENS rather than from Herit storage. The permission genuinely lives there.
    function canClaim(uint256 estateId, string calldata label, address heir) external view returns (bool) {
        // 1. Look up the estate registry.
        // 2. resource = registry.getResource(labelhash(label))
        // 3. Return hasRoles(resource, ROLE_HEIR_CLAIM, heir).
        //
        //    Consider requiring ROLE_HEIR_REGISTERED too. It proves Herit created this subname,
        //    so a name that acquired the claim bit by some other route cannot pass.
    }

    /// @notice The registry deployed for an estate, or the zero address if none.
    function estateRegistryOf(uint256 estateId) external view returns (address) {
        // TODO return the mapping entry.
    }
}
