// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";

// REVIEW - IMPORTS
//
// [1] BROKEN PATH. foundry.toml remaps `@ensdomains/contracts-v2/` to
//     `lib/contracts-v2/contracts/src/`, so this import resolves to
//     `lib/contracts-v2/contracts/src/lib/verifiable-factory/...`, which does not exist.
//     The file is really at `lib/contracts-v2/contracts/lib/verifiable-factory/src/`, i.e. under
//     `contracts/lib/`, not `contracts/src/lib/`. Fix by adding a remapping to foundry.toml:
//         "@ensdomains/verifiable-factory/=lib/contracts-v2/contracts/lib/verifiable-factory/src/"
//     That is the same alias the submodule itself uses, so paths match its source.
//
// [2] `src/libraries/HeritRolesLib.sol` works today only because Foundry falls back to the project
//     root. `./libraries/HeritRolesLib.sol` is relative to this file and cannot break if the
//     project layout moves. Prefer the relative form for your own files.

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
    error AccessControlGate__ZeroNode();

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

    IVerifiableFactory public immutable I_VERIFIABLE_FACTORY;
    address public immutable I_USER_REGISTRY_IMPL;
    IHeritRegistry public immutable I_HERIT_REGISTRY;
    IPermissionedRegistry public immutable I_GRANTOR_REGISTRY;

    address public immutable I_RESOLVER;

    /// @dev `namehash("herit.eth")`, the root of the whole tree.
    ///      Needed because the registry addresses names by labelhash while the resolver addresses
    ///      them by node, and a node can only be built by walking down from its parent:
    ///          aliceNode = keccak256(I_HERIT_NODE, labelhash("alice"))
    ///          sonNode   = keccak256(aliceNode,    labelhash("son"))
    ///      There is no way to derive this from a label alone, so it has to be supplied.
    bytes32 public immutable I_HERIT_NODE;

    mapping(uint256 estateId => address estateRegistry) private s_estateRegistries;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event EstateOpened(uint256 indexed estateId, address indexed grantor, address indexed estateRegistry, string label);
    event HeirRegistered(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint16 shareBps
    );
    event HeirUnlocked(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir);

    //
    // [13] Delete the TODO block above these now they are written.

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyHeritRegistry() {
        if (msg.sender != address(I_HERIT_REGISTRY)) {
            revert AccessControlGate__NotHeritRegistry();
        }
        _;
    }

    modifier onlyGrantorOf(uint256 estateId) {
        if (msg.sender != I_GRANTOR_REGISTRY.getOwner(estateId)) {
            revert AccessControlGate__NotGrantor();
        }
        _;
    }

    // [17] Delete the TODO block above these now they are written.

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param verifiableFactory Deploys a `UserRegistry` proxy per estate.
    /// @param userRegistryImpl The implementation those proxies delegate to.
    /// @param grantorRegistry Registry A, hanging under `herit.eth`, where grantor names live.
    /// @param resolver Holds the `herit.relationship` and `herit.share` records on heir subnames.
    /// @param heritRegistry The estate state machine, and the only caller permitted to unlock.
    /// @param heritNode `namehash("herit.eth")`, the parent every grantor name descends from.
    /// @dev `heritRegistry` is the one address that cannot exist yet when this contract is
    ///      deployed, because `HeritRegistry` takes the gate's address in its own constructor.
    ///      The cycle is broken with CREATE2 rather than a post-deploy setter: the deploy script
    ///      computes `HeritRegistry`'s address in advance from the deployer, a fixed salt and the
    ///      init code hash, then passes it here. That keeps every field `immutable`, so the
    ///      privileged caller is fixed in bytecode at deployment and there is no window, and no
    ///      function, through which it can ever be repointed. A setter would leave both.
    ///
    ///      Consequence for `script/DeployHerit.s.sol`: the gate must be deployed first, with the
    ///      predicted address, and `HeritRegistry` must then be deployed with `CREATE2` using that
    ///      exact salt. A mismatch bricks unlocking, so the script should assert equality before
    ///      it broadcasts anything else.
    constructor(
        IVerifiableFactory verifiableFactory,
        address userRegistryImpl,
        IPermissionedRegistry grantorRegistry,
        address resolver,
        IHeritRegistry heritRegistry,
        bytes32 heritNode
    ) {
        if (
            address(verifiableFactory) == address(0) || userRegistryImpl == address(0)
                || address(grantorRegistry) == address(0) || resolver == address(0)
                || address(heritRegistry) == address(0)
        ) {
            revert AccessControlGate__ZeroAddress();
        }
        // Not an address, so it needs its own check. A zero node would silently write every
        // record to the wrong place rather than reverting.
        if (heritNode == bytes32(0)) {
            revert AccessControlGate__ZeroNode();
        }

        I_VERIFIABLE_FACTORY = verifiableFactory;
        I_USER_REGISTRY_IMPL = userRegistryImpl;
        I_GRANTOR_REGISTRY = grantorRegistry;
        I_RESOLVER = resolver;
        I_HERIT_REGISTRY = heritRegistry;
        I_HERIT_NODE = heritNode;
    }

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
