// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {IHeritResolver} from "src/interfaces/IHeritResolver.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IVerifiableFactoryLogic} from "src/interfaces/IVerifiableFactoryLogic.sol";
import {CloneProxyBytecode} from "@ensdomains/verifiable-factory/CloneProxyBytecode.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";

///
///      herit.eth                     owned by the deployer EOA
///        └─ GRANTOR_REGISTRY         registry A, this contract holds root roles
///             └─ alice               a grantor, owns the name
///                  └─ estate registry   registry B, deployed per estate, this contract holds root
///                       ├─ son          an heir
///                       └─ kate         an heir

/**
 * @title AccessControlGate
 * @author Kelechi Kizito Ugwu
 * @notice The AccessControlGate contract manages access control for the Herit system.
 * @notice It acts as a bridge between ENS and the Herit registry, handling name-based permissions. It never holds funds and does not decide when an estate unlocks. The HeritRegistry contract owns that decision and calls into this contract.
 * @dev This contract holds the most dangerous privilege in the system, so every state-changing function needs an access check.
 */
contract AccessControlGate is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    /// @dev An address that must be non-zero — a constructor dependency, a grantor, or an heir — was zero.
    error AccessControlGate__ZeroAddress();
    /// @dev Only `HeritRegistry` decides when an estate unlocks, and the caller was not it.
    error AccessControlGate__NotHeritRegistry();
    /// @dev Only the address owning the estate's name in registry A may add heirs beneath it.
    error AccessControlGate__NotGrantor();
    /// @dev No registry exists for this estate, so `openEstate` was never called for its label.
    error AccessControlGate__EstateNotFound(uint256 estateId);
    /// @dev The grantor label is already registered or reserved in registry A.
    error AccessControlGate__LabelNotAvailable(string label);
    /// @dev This estate already has a registry, and deploying a second would collide in the factory.
    error AccessControlGate__EstateAlreadyOpen(uint256 estateId);
    /// @dev An heir subname may not outlive its grantor name, which would leave it unresolvable.
    error AccessControlGate__ExpiryExceedsEstate(uint64 expiry, uint64 estateExpiry);
    /// @dev The grantor name has lapsed, so a role granted now would land on a resource nothing reads.
    error AccessControlGate__EstateExpired(uint256 estateId);
    /// @dev `renewEstate` may not push an expiry beyond `MAX_RENEWAL_WINDOW`, since it can never be reduced.
    error AccessControlGate__ExpiryTooFar(uint64 newExpiry, uint64 maxExpiry);

    /// @dev `namehash("herit.eth")` was zero, which would silently write every record to the wrong node.

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

    /// @dev Selector for `initialize((address,uint256)[])` on the deployed `UserRegistryImpl`, encoded by hand because the pinned submodule declares a different signature.
    bytes4 private constant USER_REGISTRY_INITIALIZE = 0x37cb53a8;

    /// @dev SLIP-44 coin type for ETH, the key an heir's `addr` record is written under.
    uint256 private constant COIN_TYPE_ETH = 60;

    /// @dev `herit.eth` DNS-encoded: each label prefixed with its length, terminated by a zero
    ///      byte. `\x05herit\x03eth\x00`. Every setter on the deployed `PermissionedResolver`
    ///      takes a name in this form rather than a namehash, and `NameCoder.addLabel` prepends
    ///      the grantor and heir labels onto it. `constant` and not `immutable` because Solidity
    ///      permits neither `immutable` nor `constant` of dynamic type to be set in a constructor,
    ///      and this value never varies.
    bytes private constant HERIT_NAME = hex"0568657269740365746800";

    /// @dev Ceiling on how far `renewEstate` may push an expiry, since expiry can never be reduced and an unbounded permissionless renew would let the first caller pin a name forever.
    uint64 private constant MAX_RENEWAL_WINDOW = 3650 days;

    /// @dev Deploys one `UserRegistry` proxy per estate, at an address derivable before it exists.
    IVerifiableFactory public immutable I_VERIFIABLE_FACTORY;

    /// @dev The implementation every estate registry proxy delegates to.
    address public immutable I_USER_REGISTRY_IMPL;

    /// @dev The estate state machine, and the only caller permitted to unlock an heir.
    IHeritRegistry public immutable I_HERIT_REGISTRY;

    /// @dev Registry A, hanging under `herit.eth`, holding one name per grantor.
    IPermissionedRegistry public immutable I_GRANTOR_REGISTRY;

    /// @dev The `PermissionedResolver` this gate holds root write roles on, carrying every heir's `addr`, `herit.relationship` and `herit.share` records.
    address public immutable I_RESOLVER;

    /// @dev `namehash("herit.eth")`, derived from `HERIT_NAME` in the constructor so the two
    ///      forms of the same name cannot disagree. Nothing in this contract reads it — records
    ///      are addressed by name now — but `resolve` takes the node inside its inner calldata,
    ///      so callers reading heir records back need it.
    bytes32 public immutable I_HERIT_NODE;

    /// @dev The registry deployed for each estate, and the only path from an estate id to its heirs.
    mapping(uint256 estateId => address estateRegistry) private s_estateRegistries;

    mapping(uint256 estateId => string label) private s_estateLabels;

    /// @dev Estates opened for one grantor, in the order they were opened. A hint, not the truth:
    ///      the grantor name is an ENS name and can be transferred afterwards, and this index does
    ///      not move with it. Confirm with `I_GRANTOR_REGISTRY.getOwner` before showing it as theirs.
    mapping(address grantor => uint256[] estateIds) private s_estatesOfGrantor;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event EstateOpened(uint256 indexed estateId, address indexed grantor, address indexed estateRegistry, string label);
    event HeirRegistered(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint16 shareBps
    );
    event HeirUnlocked(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir);

    event EstateRenewed(uint256 indexed estateId, uint64 newExpiry, address indexed caller);

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

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param verifiableFactory Deploys a `UserRegistry` proxy per estate.
    /// @param userRegistryImpl The implementation those proxies delegate to.
    /// @param grantorRegistry Registry A, hanging under `herit.eth`, where grantor names live.
    ///        This gate MUST hold root `ROLE_RENEW` here, not only on the estate registries it
    ///        deploys itself. `PermissionedRegistry.renew` on an ALREADY-expired name takes the
    ///        `_canRevive` path, which is `hasRootRoles(ROLE_RENEW, sender)` on that registry.
    ///        `GATE_ROOT_ROLE_BITMAP` supplies it for registry B via `initialize`; registry A is
    ///        not deployed by this contract, so the deploy script has to grant it explicitly.
    ///        Without it, a lapsed grantor name is unrecoverable by anyone but registry A's root
    ///        holder, and `renewEstate` below reverts for every caller.
    /// @param resolver Holds the `herit.relationship` and `herit.share` records on heir subnames.
    ///        MUST be a `PermissionedResolver` proxy on which this gate holds `ROOT_RESOURCE`
    ///        roles (`ROLE_SET_TEXT`, `ROLE_SET_ADDR`). Its setters check the caller, so any
    ///        other resolver reverts on every record write in `registerHeir`. Root grants fall
    ///        through to every resource, so one such resolver serves every estate. The deploy
    ///        script either initializes it with the gate's predicted address as admin, or
    ///        initializes it to the deployer and grants the gate root roles straight after.
    /// @param heritRegistry The estate state machine, and the only caller permitted to unlock.
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
        IHeritRegistry heritRegistry
    ) {
        if (
            address(verifiableFactory) == address(0) || userRegistryImpl == address(0)
                || address(grantorRegistry) == address(0) || resolver == address(0)
                || address(heritRegistry) == address(0)
        ) {
            revert AccessControlGate__ZeroAddress();
        }
        I_VERIFIABLE_FACTORY = verifiableFactory;
        I_USER_REGISTRY_IMPL = userRegistryImpl;
        I_GRANTOR_REGISTRY = grantorRegistry;
        I_RESOLVER = resolver;
        I_HERIT_REGISTRY = heritRegistry;
        // Derived, not supplied: `HERIT_NAME` and `I_HERIT_NODE` are the same name in two forms,
        // and a constructor argument could disagree with the constant. Records would then be
        // written under one name and read under another, with nothing reverting to say so.
        I_HERIT_NODE = NameCoder.namehash(HERIT_NAME, 0);
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Onboards a grantor: gives them `label.herit.eth` and its own empty heir registry.
    /// @param label The grantor's label, e.g. "alice".
    /// @param grantor The address that will own the name.
    /// @param expiry When the grantor's name lapses. Must outlast every heir subname beneath it.
    ///        Set it long. `renewEstate` can extend it later, but only while this gate holds
    ///        root `ROLE_RENEW` on registry A, and a lapse in between is publicly squattable.
    /// @return estateRegistry The registry deployed for this estate.
    /// @dev Permissionless, first-come-first-served, like ENS registration itself. `onlyGrantorOf`
    ///      cannot apply because the name has no owner until this call creates it, and gating on
    ///      `HeritRegistry` would mean an estate could not be set up before its state machine
    ///      exists. The cost is that labels are squattable; the label is not a claim on anything,
    ///      since the caller chooses `grantor` and holds nothing themselves.
    function openEstate(string calldata label, address grantor, uint64 expiry)
        external
        nonReentrant
        returns (address estateRegistry)
    {
        if (grantor == address(0)) {
            revert AccessControlGate__ZeroAddress();
        }

        uint256 estateId = _labelhash(label);

        // The factory's CREATE2 would revert with an empty reason on a repeated salt.
        if (s_estateRegistries[estateId] != address(0)) {
            revert AccessControlGate__EstateAlreadyOpen(estateId);
        }
        if (I_GRANTOR_REGISTRY.getStatus(estateId) != IPermissionedRegistry.Status.AVAILABLE) {
            revert AccessControlGate__LabelNotAvailable(label);
        }

        // Registry B, with this gate as its only root role holder. That grant is what makes every
        // later `grantRoles` on an heir possible, so nothing else may hold it.
        RoleAssignment[] memory roles = new RoleAssignment[](1);
        roles[0] = RoleAssignment({account: address(this), roleBitmap: HeritRolesLib.GATE_ROOT_ROLE_BITMAP});
        estateRegistry = I_VERIFIABLE_FACTORY.deployProxy(
            I_USER_REGISTRY_IMPL, _estateSalt(estateId), abi.encodeWithSelector(USER_REGISTRY_INITIALIZE, roles)
        );

        s_estateRegistries[estateId] = estateRegistry;
        s_estateLabels[estateId] = label;
        s_estatesOfGrantor[grantor].push(estateId);

        // `GRANTOR_NAME_ROLE_BITMAP` withholds `ROLE_SET_SUBREGISTRY`, so the grantor cannot swap
        // registry B for one they control and hand themselves every heir role.
        I_GRANTOR_REGISTRY.register(
            label, grantor, IRegistry(estateRegistry), I_RESOLVER, HeritRolesLib.GRANTOR_NAME_ROLE_BITMAP, expiry
        );

        emit EstateOpened(estateId, grantor, estateRegistry, label);
    }

    /// @notice Adds an heir to an estate as a subname, with the claim role withheld.
    /// @param estateId The grantor label hash.
    /// @param label The heir's label, e.g. "son".
    /// @param heir The address that will own the heir subname.
    /// @param relationship Free text written to the `herit.relationship` record.
    /// @param shareBps The heir's share in basis points, written to `herit.share`.
    /// @param expiry When the heir subname lapses. Cannot exceed the grantor name's expiry.
    /// @return tokenId The heir subname token. Returned for the receipt only — never store it.
    /// @dev Gated on the grantor rather than `HeritRegistry` because the estate's state machine
    ///      holds no heir list yet. Move to `onlyHeritRegistry` once it does, or the share matrix
    ///      there and the `herit.share` records here can drift apart silently.
    function registerHeir(
        uint256 estateId,
        string calldata label,
        address heir,
        string calldata relationship,
        uint16 shareBps,
        uint64 expiry
    ) external nonReentrant onlyGrantorOf(estateId) returns (uint256 tokenId) {
        if (heir == address(0)) {
            revert AccessControlGate__ZeroAddress();
        }

        // Scoped so the locals leave the stack. Six parameters plus the resolver writes overflow
        // it otherwise, and the compiler's only complaint is "stack too deep".
        {
            // ENSv2 does not cap a child's expiry against its parent's. An heir subname outliving
            // the grantor name would stop resolving the moment the parent lapses.
            uint64 estateExpiry = I_GRANTOR_REGISTRY.getExpiry(estateId);
            if (expiry > estateExpiry) {
                revert AccessControlGate__ExpiryExceedsEstate(expiry, estateExpiry);
            }
        }

        // Registry B, not registry A. The bitmap withholds `ROLE_HEIR_CLAIM` on purpose; granting
        // it later is the unlock.
        tokenId = _estateRegistry(estateId)
            .register(
                label, heir, IRegistry(address(0)), I_RESOLVER, HeritRolesLib.HEIR_REGISTRATION_ROLE_BITMAP, expiry
            );

        _writeHeirRecords(estateId, label, heir, relationship, shareBps);

        // After the ENS mint, so a duplicate label reverts there rather than here, and after the
        // records, so a rejected share leaves no orphan subname. `HeritRegistry` owns the share
        // matrix and enforces both the 100% cap and `MAX_HEIRS`.
        I_HERIT_REGISTRY.recordHeir(estateId, label, heir, shareBps);

        emit HeirRegistered(estateId, _labelhash(label), heir, shareBps);
    }

    /// @notice Grants an heir the claim role. Called by `HeritRegistry` when an estate unlocks.
    /// @param estateId The grantor label hash.
    /// @param label The heir's label.
    /// @param heir The heir address receiving the role.
    function unlockHeir(uint256 estateId, string calldata label, address heir) external onlyHeritRegistry nonReentrant {
        IPermissionedRegistry registry = _estateRegistry(estateId);
        uint256 heirLabelhash = _labelhash(label);
        // Registry B for this estate, and the id the registry files the heir under. `_estateRegistry`
        // reverts if `HeritRegistry` ever asks to unlock an estate that was never opened.

        uint64 estateExpiry = I_GRANTOR_REGISTRY.getExpiry(estateId);
        if (estateExpiry <= block.timestamp) {
            revert AccessControlGate__EstateExpired(estateId);
        }
        // Refuse to unlock into a lapsed estate. Neither step below can succeed under a dead
        // parent: renewing the heir would only extend a name nobody can resolve, and the grant
        // would land on a resource id nothing reads. `renewEstate` has to run first.

        if (registry.getExpiry(heirLabelhash) < estateExpiry) {
            registry.renew(heirLabelhash, estateExpiry);
        }
        // The clamp. Renew the heir subname *up to* the estate's own expiry and never past it,
        // which is the same invariant `registerHeir` enforces at registration. Renewing further
        // would buy nothing: a child that outlives its parent stops resolving anyway.
        //
        // The renew itself is not optional. A role granted on an expired name is written to
        // `eacVersionId + 1` — a resource id that nothing reads — so unlocking a lapsed heir
        // would appear to succeed and quietly do nothing. This is why `GATE_ROOT_ROLE_BITMAP`
        // carries `ROLE_RENEW`, and that root role is also what lets the gate revive an heir
        // subname that has already expired.

        registry.grantRoles(heirLabelhash, HeritRolesLib.ROLE_HEIR_CLAIM, heir);
        // The inheritance, in one call, in the real ENS registry. The bit withheld at registration
        // is now set, so `canClaim` starts returning true and `ClaimManager` will release funds.
        // Side effect: this burns and re-mints the heir's subname token, so its token id changes.
        // Never cache one.

        emit HeirUnlocked(estateId, heirLabelhash, heir);
        // No resolver write anywhere above. Records were fixed at registration; unlock changes
        // permission, not identity.
    }

    /// @notice Rewrites an heir's share record after `HeritRegistry.setShare`. Registry only.
    /// @dev Display metadata, not the source of truth — `HeritRegistry` holds the share matrix and
    ///      `ClaimManager` pays from that. This keeps the name from advertising a stale number.
    function writeShareRecord(uint256 estateId, string calldata label, address token, uint16 bps)
        external
        onlyHeritRegistry
        nonReentrant
    {
        IHeritResolver(I_RESOLVER).setText(_heirName(estateId, label), _shareKey(token), Strings.toString(bps));
    }

    /// @notice Extends a grantor name's registration. Permissionless: anyone may pay the gas.
    /// @param estateId The grantor label hash.
    /// @param newExpiry The new expiry. Cannot be earlier than the current one.
    /// @dev Deliberately open to any caller, the same shape as `HeritRegistry.pokeExpiry()`.
    ///      Herit's whole premise is that the grantor eventually stops doing things, so an expiry
    ///      only the grantor can extend is a second dead-man's switch nobody designed, and it
    ///      fires in a squatter's favour. What lapsing actually costs:
    ///
    ///        - Assets already claimed are untouched. They are at an address, not in a name.
    ///        - The heir subnames in registry B are untouched. Expiry is per-registry, per-entry;
    ///          nothing caps a child's expiry against its parent's, and `canClaim` reaches
    ///          registry B by stored address without walking registry A, so claiming still works.
    ///        - Resolution dies. `getSubregistry`/`getResolver` return zero once expired, so the
    ///          walk herit.eth -> father stops there and every heir subname beneath it goes dark.
    ///        - The label returns to AVAILABLE, so anyone can re-register `father` pointing at a
    ///          subregistry they control. `son.father.herit.eth` then resolves to a stranger while
    ///          the real heir's token is orphaned in registry B. Nothing reverts; the name lies.
    ///        - Roles on the expired name are orphaned, not revoked: `_constructResource` returns
    ///          `eacVersionId + 1` once expired, so grants point at a resource id that no longer
    ///          resolves.
    function renewEstate(uint256 estateId, uint64 newExpiry) external {
        if (s_estateRegistries[estateId] == address(0)) {
            revert AccessControlGate__EstateNotFound(estateId);
        }
        // Registry A holds nothing but Herit estates, but this turns "unknown label" into a named
        // error instead of a confusing revert from inside ENS.

        uint64 maxExpiry = uint64(block.timestamp) + MAX_RENEWAL_WINDOW;
        if (newExpiry > maxExpiry) {
            revert AccessControlGate__ExpiryTooFar(newExpiry, maxExpiry);
        }
        // Because expiry can never be reduced, the first caller of an unbounded renew could pin the
        // name to `type(uint64).max` and no one could ever correct it. The ceiling is a rolling
        // window, so repeated renewals still extend indefinitely, one decade at a time.

        I_GRANTOR_REGISTRY.renew(estateId, newExpiry);
        // `estateId` IS the grantor labelhash, which is what `renew` accepts as its `anyId`.
        // Reverts `CannotReduceExpiry` if `newExpiry` is earlier than the current one. If the name
        // has already lapsed, this takes the revive path, which needs root `ROLE_RENEW` on registry
        // A — see the constructor note.

        emit EstateRenewed(estateId, newExpiry, msg.sender);
        // `caller` is indexed because this is the only function here callable by someone with no
        // relationship to the estate, so it is worth being able to filter on who paid.
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev The registry keys off `labelhash("son")`; the resolver keys off the namehash of the
    ///      full name. Different values, two hops down from the root. Split out of `registerHeir`
    ///      to keep that function's stack under the limit.
    function _writeHeirRecords(
        uint256 estateId,
        string calldata label,
        address heir,
        string calldata relationship,
        uint16 shareBps
    ) internal {
        bytes memory heirName = _heirName(estateId, label);

        IHeritResolver resolver = IHeritResolver(I_RESOLVER);
        resolver.setAddress(heirName, COIN_TYPE_ETH, abi.encodePacked(heir));
        resolver.setText(heirName, "herit.relationship", relationship);
        resolver.setText(heirName, _shareKey(address(0)), Strings.toString(shareBps));
    }

    /// @dev The text key an heir's share of one token is written under. The estate-wide default
    ///      lives at `herit.share`; a per-token override is namespaced by the token address so it
    ///      cannot overwrite the default. `address(0)` is the vault's native-asset sentinel.
    function _shareKey(address token) internal pure returns (string memory) {
        return token == address(0) ? "herit.share" : string.concat("herit.share.", Strings.toHexString(token));
    }

    function _estateRegistry(uint256 estateId) internal view returns (IPermissionedRegistry) {
        address registry = s_estateRegistries[estateId];
        if (registry == address(0)) {
            revert AccessControlGate__EstateNotFound(estateId);
        }
        return IPermissionedRegistry(registry);
    }

    /// @dev The heir's full name spelled out, which is the form every resolver setter wants.
    function _heirName(uint256 estateId, string calldata label) internal view returns (bytes memory) {
        return NameCoder.addLabel(NameCoder.addLabel(HERIT_NAME, s_estateLabels[estateId]), label);
    }

    /// @dev The estate id is the grantor labelhash, which is also what the registry accepts as
    ///      `anyId`, so the same value keys Herit storage and every ENS call.
    function _labelhash(string calldata label) internal pure returns (uint256) {
        return uint256(keccak256(bytes(label)));
    }

    /// @dev Domain-tagged so a second kind of proxy deployed from this gate can never collide with
    ///      an estate. The factory already namespaces by `msg.sender`, so other callers cannot.
    ///      Shared with `predictEstateRegistry`, which must derive the same address.
    function _estateSalt(uint256 estateId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("estate", estateId)));
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Whether an heir may claim. Read by `ClaimManager`.
    /// @dev Answers from ENS rather than from Herit storage. The permission genuinely lives there.
    function canClaim(uint256 estateId, string calldata label, address heir) external view returns (bool) {
        address registry = s_estateRegistries[estateId];
        if (registry == address(0)) {
            return false;
        }
        // Returns false rather than reverting. `ClaimManager` asks this as a question, and a view
        // that throws on an unknown estate forces every caller to wrap it in a try/catch.

        uint256 resource = IPermissionedRegistry(registry).getResource(_labelhash(label));
        // A resource is the permission scope for one name. It is the labelhash combined with the
        // name's EAC version counter, so re-registering a name yields a fresh scope and old grants
        // do not carry over to whoever holds the label next.

        return IPermissionedRegistry(registry)
            .hasRoles(resource, HeritRolesLib.ROLE_HEIR_CLAIM | HeritRolesLib.ROLE_HEIR_REGISTERED, heir);
        // `hasRoles` requires the whole bitmap, not any one bit, so this is really two questions in
        // one call: has the estate unlocked for this heir (`ROLE_HEIR_CLAIM`), and did Herit create
        // this subname in the first place (`ROLE_HEIR_REGISTERED`)? The second bit is what stops a
        // name that acquired the claim bit by some other route from passing.
    }

    /// @notice The registry an estate WOULD get, without opening it. For the frontend.
    /// @dev Mirrors the reference's `predictAccount`. Must use the same `_estateSalt` as
    ///      `openEstate`, and the factory's outer salt is keccak256(abi.encode(gate, salt)).
    function predictEstateRegistry(uint256 estateId) external view returns (address) {
        bytes32 outerSalt = keccak256(abi.encode(address(this), _estateSalt(estateId)));
        // The factory does not use the caller's salt directly. It hashes the caller in first, which
        // is what stops two callers who pick the same salt from colliding. `address(this)` is the
        // caller here, because the gate is what will call `deployProxy`.

        address logic = IVerifiableFactoryLogic(address(I_VERIFIABLE_FACTORY)).proxyLogic();
        // Every proxy the factory makes is an EIP-1167 clone pointing at this one shared logic
        // contract, so its address is baked into the bytecode whose hash CREATE2 needs.

        return Create2.computeAddress(
            outerSalt, keccak256(CloneProxyBytecode.creationCode(logic, outerSalt)), address(I_VERIFIABLE_FACTORY)
        );
        // CREATE2 addresses are a pure function of deployer, salt and creation code, so this is the
        // same arithmetic the EVM will do at deploy time. The salt appears twice on purpose: once
        // as the CREATE2 salt, and once inside the creation code, because the factory appends it to
        // the proxy's runtime so it can verify the proxy later.
    }

    /// @notice The registry deployed for an estate, or the zero address if none.
    /// @notice Every estate this address opened, so a connected wallet can find its own.
    /// @dev Ownership can have moved since. The caller checks `getOwner(estateId)` per entry.
    function estatesOfGrantor(address grantor) external view returns (uint256[] memory) {
        return s_estatesOfGrantor[grantor];
    }

    function estateRegistryOf(uint256 estateId) external view returns (address) {
        return s_estateRegistries[estateId];
        // Zero means "not opened". Callers that need a hard failure use the internal
        // `_estateRegistry`, which reverts instead.
    }
}
