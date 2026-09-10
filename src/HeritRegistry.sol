// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritVault} from "src/HeritVault.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";

contract HeritRegistry is ReentrancyGuard, IHeritRegistry {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error HeritRegistry__ZeroAddress();
    error HeritRegistry__NotGrantor();
    error HeritRegistry__NotGate();
    error HeritRegistry__NotAttestor();
    error HeritRegistry__EstateNotFound(uint256 estateId);
    error HeritRegistry__NotConfigured(uint256 estateId);
    error HeritRegistry__EstateUnlocked(uint256 estateId);
    error HeritRegistry__InvalidTimers();
    error HeritRegistry__TooManyHeirs(uint256 maxHeirs);
    error HeritRegistry__HeirNotFound(uint256 heirLabelhash);
    error HeritRegistry__ShareOverflow(uint256 totalBps);
    error HeritRegistry__NotActive(uint256 estateId);
    error HeritRegistry__TooManyTokens(uint256 maxTokens);

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    struct Estate {
        uint64 lastCheckIn; // last time the lieveness(selfie) check was passed
        uint64 checkInInterval; // how often the grantor must check in to avoid entering grace
        uint64 graceDuration; // how long the grace period lasts before unlocking
        Status status; // the current status of the estate, as per the state machine
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    IPermissionedRegistry public immutable I_GRANTOR_REGISTRY; // registry A — who the grantor is
    AccessControlGate public immutable I_GATE;
    HeritVault public immutable I_VAULT;
    address public immutable I_ATTESTOR; // @question: who is the attestor?

    uint16 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_HEIRS = 10; // @question why are we cappiung the max number of heirs?

    /// @dev How many tokens one estate may carry per-token overrides for. Matches
    ///      `HeritVault.MAX_TOKENS`, because a token the vault will not hold cannot be paid out.
    ///      The cap is what keeps `recordHeir`'s cross-check bounded.
    uint256 public constant MAX_OVERRIDE_TOKENS = 10;

    /// @dev The ends of the two ranges the setup screen offers, in `frontend/lib/estate/presets.ts`.
    ///      Public so the form can read them instead of keeping its own copy that drifts.
    uint64 public constant MIN_CHECK_IN_INTERVAL = 2 minutes;
    uint64 public constant MAX_CHECK_IN_INTERVAL = 90 days;
    uint64 public constant MIN_GRACE_DURATION = 1 minutes;
    uint64 public constant MAX_GRACE_DURATION = 14 days;

    /// @dev One heir slot: which estate, and which name inside it. An address can hold several,
    ///      in one estate or across many.
    struct HeirSlot {
        uint256 estateId;
        uint256 heirLabelhash;
    }

    mapping(uint256 estateId => Estate estate) private s_estates;

    /// @dev Every slot an address was registered into, in registration order. Stable: an heir
    ///      address is fixed at `recordHeir` and there is no path that reassigns it.
    mapping(address heir => HeirSlot[] slots) private s_slotsOfHeir;

    mapping(uint256 estateId => uint256[] heirLabelhashes) private s_heirs;
    mapping(uint256 estateId => mapping(uint256 heirLabelhash => address heir)) private s_heirAddress;

    /// @dev The heir's label, kept because `AccessControlGate` addresses ENS records and role
    ///      grants by name and a labelhash cannot be reversed.
    mapping(uint256 estateId => mapping(uint256 heirLabelhash => string label)) private s_heirLabel;

    mapping(uint256 estateId => mapping(uint256 heirLabelhash => uint16 bps)) private s_defaultShare;
    mapping(uint256 estateId => uint16 bps) private s_allocatedDefaultBps;

    mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => uint16 bps))) private s_share;
    mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => bool))) private s_hasOverride;

    /// @dev Every token this estate has at least one override for. `recordHeir` walks it to check
    ///      that a late heir does not push an already-overridden token past 100%; without it the
    ///      default ledger and the per-token matrix guard different numbers and neither sees the
    ///      other. Bounded by `MAX_OVERRIDE_TOKENS`.
    mapping(uint256 estateId => address[] tokens) private s_overriddenTokens;
    mapping(uint256 estateId => mapping(address token => bool listed)) private s_tokenListed;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event EstateConfigured(uint256 indexed estateId, uint64 checkInInterval, uint64 graceDuration);
    event HeirRecorded(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint16 defaultShareBps
    );
    event ShareSet(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed token, uint16 bps);
    event CheckedIn(uint256 indexed estateId, uint64 at);
    event EnteredGrace(uint256 indexed estateId, uint64 at);
    event Unlocked(uint256 indexed estateId, uint64 at, uint256 heirCount);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyGrantorOf(uint256 estateId) {
        _onlyGrantorOf(estateId);
        _;
    }
    modifier onlyGate() {
        _onlyGate();
        _;
    }
    modifier onlyAttestor() {
        _onlyAttestor();
        _;
    }
    modifier notUnlocked(uint256 estateId) {
        _notUnlocked(estateId);
        _;
    }

    modifier onlyActive(uint256 estateId) {
        _onlyActive(estateId);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(IPermissionedRegistry grantorRegistry, AccessControlGate gate, HeritVault vault, address attestor) {
        if (address(grantorRegistry) == address(0)) {
            revert HeritRegistry__ZeroAddress();
        }
        if (address(gate) == address(0)) {
            revert HeritRegistry__ZeroAddress();
        }
        if (address(vault) == address(0)) {
            revert HeritRegistry__ZeroAddress();
        }
        if (attestor == address(0)) {
            revert HeritRegistry__ZeroAddress();
        }
        I_GRANTOR_REGISTRY = grantorRegistry;
        I_GATE = gate;
        I_VAULT = vault;
        I_ATTESTOR = attestor;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sets the estate's two timers. Grantor only, and only while Active.
    /// @dev Does NOT touch `lastCheckIn`. Only `checkIn` moves that, because moving it claims a
    ///      live human passed a Selfie Check. `onlyActive` and not `notUnlocked`: from Grace, a
    ///      longer interval would recompute back to Active — recovery without proof.
    function configure(uint256 estateId, uint64 checkInInterval, uint64 graceDuration)
        external
        onlyGrantorOf(estateId)
        onlyActive(estateId)
    {
        if (checkInInterval < MIN_CHECK_IN_INTERVAL || checkInInterval > MAX_CHECK_IN_INTERVAL) {
            revert HeritRegistry__InvalidTimers();
        }
        if (graceDuration < MIN_GRACE_DURATION || graceDuration > MAX_GRACE_DURATION) {
            revert HeritRegistry__InvalidTimers();
        }

        Estate storage estate = s_estates[estateId]; // @question: where does s_estates come from?
        estate.checkInInterval = checkInInterval;
        estate.graceDuration = graceDuration;

        // A shorter interval moves the deadline backwards, maybe into the past. Re-read after
        // writing: retune the timers, but never out of Active.
        if (_pendingStatus(estateId) != Status.Active) {
            revert HeritRegistry__InvalidTimers();
        }

        emit EstateConfigured(estateId, checkInInterval, graceDuration);
    }

    function checkIn(uint256 estateId) external nonReentrant onlyAttestor {
        Estate storage estate = s_estates[estateId];
        // Keyed on the interval, not `lastCheckIn`: `configure` no longer starts the clock, so
        // this call is the one that sets it.
        if (estate.checkInInterval == 0) {
            revert HeritRegistry__NotConfigured(estateId);
        }
        //  check the pending status, not the stored one. Otherwise a grantor whose grace lapsed a week ago, in an estate nobody has poked, could check in and erase the heirs' pending claim.
        if (_pendingStatus(estateId) == Status.Unlocked) {
            revert HeritRegistry__EstateUnlocked(estateId);
        }
        estate.lastCheckIn = uint64(block.timestamp);
        estate.status = Status.Active;

        emit CheckedIn(estateId, estate.lastCheckIn);
    }

    function pokeExpiry(uint256 estateId) external nonReentrant {
        Status pending = _pendingStatus(estateId);
        Status stored = s_estates[estateId].status;
        if (pending == stored) return;
        if (pending == Status.Grace) {
            s_estates[estateId].status = Status.Grace;
            emit EnteredGrace(estateId, uint64(block.timestamp));
        } else if (pending == Status.Unlocked) {
            _unlock(estateId);
        }
    }

    /// @inheritdoc IHeritRegistry
    /// @dev The cap is what keeps the unlock loop's gas bounded. Duplicate labels are stopped one
    ///      level up: `registerHeir` mints the subname in ENS first, and that reverts on a name
    ///      already taken.
    function recordHeir(uint256 estateId, string calldata label, address heir, uint16 defaultShareBps)
        external
        nonReentrant
        onlyGate
    {
        if (s_heirs[estateId].length >= MAX_HEIRS) {
            revert HeritRegistry__TooManyHeirs(MAX_HEIRS);
        }
        if (heir == address(0)) {
            revert HeritRegistry__ZeroAddress();
        }
        // Widened before adding. Two `uint16`s summing past 65535 panic on overflow instead of
        // reaching the error below.
        uint256 allocated = uint256(s_allocatedDefaultBps[estateId]) + defaultShareBps;
        if (allocated > BPS_DENOMINATOR) {
            revert HeritRegistry__ShareOverflow(allocated);
        }

        // The default ledger above only knows about defaults. A token someone has already set an
        // override for has its own total, and this heir's default lands on top of it. Checked
        // before the push, so `_totalBps` does not yet count the heir being added.
        address[] storage tokens = s_overriddenTokens[estateId];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenTotal = _totalBps(estateId, tokens[i]) + defaultShareBps;
            if (tokenTotal > BPS_DENOMINATOR) {
                revert HeritRegistry__ShareOverflow(tokenTotal);
            }
        }

        uint256 heirLabelhash = uint256(keccak256(bytes(label)));
        s_heirs[estateId].push(heirLabelhash);
        s_heirAddress[estateId][heirLabelhash] = heir;
        s_heirLabel[estateId][heirLabelhash] = label;
        s_defaultShare[estateId][heirLabelhash] = defaultShareBps;
        s_slotsOfHeir[heir].push(HeirSlot({estateId: estateId, heirLabelhash: heirLabelhash}));
        s_allocatedDefaultBps[estateId] = uint16(allocated); // forge-lint: disable-next-line(unsafe-typecast) // <= BPS_DENOMINATOR, so the cast is safe

        emit HeirRecorded(estateId, heirLabelhash, heir, defaultShareBps);
    }

    function setShare(uint256 estateId, uint256 heirLabelhash, address token, uint16 bps)
        external
        nonReentrant
        onlyGrantorOf(estateId)
        notUnlocked(estateId)
    {
        if (s_heirAddress[estateId][heirLabelhash] == address(0)) {
            revert HeritRegistry__HeirNotFound(heirLabelhash);
        }
        // The prospective total, not the current one. `_totalBps` already counts this heir's
        // existing share of this token, so swap that out for `bps` before comparing — otherwise
        // the guard only ever re-checks a total that already passed, and `bps` goes in unchecked.
        // No underflow: `_totalBps` sums every heir including this one, so it is >= `current`.
        uint256 current = _effectiveShare(estateId, heirLabelhash, token);
        uint256 prospective = _totalBps(estateId, token) - current + bps;
        if (prospective > BPS_DENOMINATOR) {
            revert HeritRegistry__ShareOverflow(prospective);
        }
        if (!s_tokenListed[estateId][token]) {
            if (s_overriddenTokens[estateId].length >= MAX_OVERRIDE_TOKENS) {
                revert HeritRegistry__TooManyTokens(MAX_OVERRIDE_TOKENS);
            }
            s_tokenListed[estateId][token] = true;
            s_overriddenTokens[estateId].push(token);
        }

        s_share[estateId][heirLabelhash][token] = bps;
        s_hasOverride[estateId][heirLabelhash][token] = true;

        // Mirror onto ENS last, after this contract's own state is settled. The record is display
        // metadata; the matrix above is what `ClaimManager` pays from.
        I_GATE.writeShareRecord(estateId, s_heirLabel[estateId][heirLabelhash], token, bps);

        emit ShareSet(estateId, heirLabelhash, token, bps);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @dev The one irreversible transition. Status first, then the three effects, then the event.
    ///      No `nonReentrant` of its own: the only caller is `pokeExpiry`, which already holds the
    ///      guard, and a second acquisition would revert.
    function _unlock(uint256 estateId) internal {
        s_estates[estateId].status = Status.Unlocked;

        // Renew before anything else. `unlockHeir` refuses to grant into a lapsed estate, and a
        // role written against an expired name lands on a resource id nothing reads.
        if (I_GRANTOR_REGISTRY.getExpiry(estateId) <= block.timestamp) {
            I_GATE.renewEstate(estateId, uint64(block.timestamp) + 365 days);
        }

        // Freeze the balances before any heir can claim, so every share is measured against the
        // same total. The vault makes this idempotent, which matters because `pokeExpiry` is
        // permissionless and two callers can land in the same block.
        I_VAULT.snapshot(estateId);

        // The inheritance. Bounded by `MAX_HEIRS`, which is the whole reason that cap exists.
        uint256[] storage heirs = s_heirs[estateId];
        uint256 heirCount = heirs.length;
        for (uint256 i = 0; i < heirCount; i++) {
            uint256 heirLabelhash = heirs[i];
            I_GATE.unlockHeir(estateId, s_heirLabel[estateId][heirLabelhash], s_heirAddress[estateId][heirLabelhash]);
        }

        emit Unlocked(estateId, uint64(block.timestamp), heirCount);
    }

    function _onlyGate() internal view {
        if (msg.sender != address(I_GATE)) {
            revert HeritRegistry__NotGate();
        }
    }

    function _onlyAttestor() internal view {
        if (msg.sender != I_ATTESTOR) {
            revert HeritRegistry__NotAttestor();
        }
    }

    /// @dev Pending status, not the stored field. A grantor whose grace lapsed in an estate nobody
    ///      has poked must not still pass a guard meant to stop them.
    function _notUnlocked(uint256 estateId) internal view {
        if (_pendingStatus(estateId) == Status.Unlocked) {
            revert HeritRegistry__EstateUnlocked(estateId);
        }
    }

    function _onlyGrantorOf(uint256 estateId) internal view {
        if (msg.sender != I_GRANTOR_REGISTRY.getOwner(estateId)) {
            revert HeritRegistry__NotGrantor();
        }
    }

    function _onlyActive(uint256 estateId) internal view {
        if (_pendingStatus(estateId) != Status.Active) {
            revert HeritRegistry__NotActive(estateId);
        }
    }

    /// @dev One heir's share of one token: the per-token override where one was set, the default
    ///      otherwise.
    function _effectiveShare(uint256 estateId, uint256 heirLabelhash, address token) internal view returns (uint256) {
        return s_hasOverride[estateId][heirLabelhash][token]
            ? s_share[estateId][heirLabelhash][token]
            : s_defaultShare[estateId][heirLabelhash];
    }

    /// @dev Sum of every heir's effective share of one token. The loop is bounded by `MAX_HEIRS`.
    function _totalBps(uint256 estateId, address token) internal view returns (uint256 total) {
        uint256[] storage heirs = s_heirs[estateId];
        for (uint256 i = 0; i < heirs.length; i++) {
            total += _effectiveShare(estateId, heirs[i], token);
        }
    }

    /// @notice What the status would be if someone poked the estate right now.
    /// @dev Stored `status` is a cache that only moves on `pokeExpiry`. This is the truth, and
    ///      every guard here plus `HeritVault` via `statusOf` must read it rather than the field.
    function _pendingStatus(uint256 estateId) internal view returns (Status) {
        // First, before any arithmetic. Unlock is irreversible: once stored, ENS roles are granted
        // and the vault is frozen. No date maths may argue with it.
        if (s_estates[estateId].status == Status.Unlocked) {
            return Status.Unlocked;
        }

        (uint256 graceStartsAt, uint256 unlocksAt) = _deadlines(estateId);

        // Not configured, or not started. `Active` and not `Unlocked`: a zero `lastCheckIn` puts
        // the deadline in 1970, which would unlock every estate nobody has set up yet.
        if (graceStartsAt == 0) {
            return Status.Active;
        }

        // `graceStartsAt` is the first Grace second, not the last Active one. Same at unlock.
        if (block.timestamp < graceStartsAt) {
            return Status.Active;
        }
        if (block.timestamp < unlocksAt) {
            return Status.Grace;
        }
        return Status.Unlocked;
    }

    /// @dev The two moments the state machine turns on. Zero for both when the estate has no timers
    ///      or has never checked in, which is the case `_pendingStatus` reads as Active.
    function _deadlines(uint256 estateId) internal view returns (uint256 graceStartsAt, uint256 unlocksAt) {
        Estate storage estate = s_estates[estateId];
        if (estate.checkInInterval == 0 || estate.lastCheckIn == 0) {
            return (0, 0);
        }
        // Widened to `uint256` before adding. Caller-set timers could otherwise wrap a `uint64`
        // into a deadline in the past and unlock a healthy estate.
        graceStartsAt = uint256(estate.lastCheckIn) + estate.checkInInterval;
        unlocksAt = graceStartsAt + estate.graceDuration;
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @notice One heir's share of one token, in basis points.
    /// @dev The per-token override where the grantor set one, the estate-wide default otherwise.
    function shareOf(uint256 estateId, uint256 heirLabelhash, address token) external view returns (uint256) {
        return _effectiveShare(estateId, heirLabelhash, token);
    }

    /// @notice The heir labelhashes recorded against an estate, in registration order.
    function heirsOf(uint256 estateId) external view returns (uint256[] memory) {
        return s_heirs[estateId];
    }

    /// @notice The label an heir was registered under.
    function heirLabelOf(uint256 estateId, uint256 heirLabelhash) external view returns (string memory) {
        return s_heirLabel[estateId][heirLabelhash];
    }

    /// @inheritdoc IHeritRegistry
    function statusOf(uint256 estateId) external view returns (Status) {
        return _pendingStatus(estateId);
    }

    // To check whether a label is available for registration,
    /// @notice Every estate this address is an heir of, so a connected wallet can find its own.
    /// @dev The counterpart to `heirsOf`, which reads the other way. Unbounded in principle — an
    ///      address can be an heir anywhere — so page it off-chain rather than in a transaction.
    function heirSlotsOf(address heir) external view returns (HeirSlot[] memory) {
        return s_slotsOfHeir[heir];
    }

    /// @notice Every timer on one estate in a single read, for the dashboard countdown.
    /// @dev `status` is the pending one, not the cached field, so it cannot disagree with
    ///      `statusOf`. Everything else is storage as written.
    function estateOf(uint256 estateId) external view returns (Estate memory estate) {
        estate = s_estates[estateId];
        estate.status = _pendingStatus(estateId);
    }

    /// @notice When this estate enters Grace and when it unlocks, in unix seconds.
    /// @dev Both zero until the estate is configured and has checked in once. Same arithmetic the
    ///      state machine runs, so the countdown on screen and the transition on-chain agree.
    function deadlinesOf(uint256 estateId) external view returns (uint256 graceStartsAt, uint256 unlocksAt) {
        return _deadlines(estateId);
    }

    /// @notice The address recorded for one heir.
    function heirAddressOf(uint256 estateId, uint256 heirLabelhash) external view returns (address) {
        return s_heirAddress[estateId][heirLabelhash];
    }

    /// @notice One heir's estate-wide share, before any per-token override.
    function defaultShareOf(uint256 estateId, uint256 heirLabelhash) external view returns (uint16) {
        return s_defaultShare[estateId][heirLabelhash];
    }

    function isAvailable(string calldata label) external view returns (bool) {
        IPermissionedRegistry.State memory state = I_GRANTOR_REGISTRY.getState(uint256(keccak256(bytes(label))));
        return state.status == IPermissionedRegistry.Status.AVAILABLE;
    }
}
