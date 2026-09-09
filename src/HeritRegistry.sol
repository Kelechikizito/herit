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

    // Ceilings so a stolen key cannot set a 100-year interval and freeze the heirs out.
    // Floors low so the whole state machine can be walked live in the demo.
    uint64 private constant MIN_CHECK_IN_INTERVAL = 1 minutes;
    uint64 private constant MAX_CHECK_IN_INTERVAL = 365 days;
    uint64 private constant MIN_GRACE_DURATION = 1 minutes;
    uint64 private constant MAX_GRACE_DURATION = 90 days;

    mapping(uint256 estateId => Estate estate) private s_estates;

    mapping(uint256 estateId => uint256[] heirLabelhashes) private s_heirs;
    mapping(uint256 estateId => mapping(uint256 heirLabelhash => address heir)) private s_heirAddress;

    mapping(uint256 estateId => mapping(uint256 heirLabelhash => uint16 bps)) private s_defaultShare;
    mapping(uint256 estateId => uint16 bps) private s_allocatedDefaultBps;

    mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => uint16 bps))) private s_share;
    mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => bool))) private s_hasOverride;

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
            s_estates[estateId].status = Status.Unlocked;
            emit Unlocked(estateId, uint64(block.timestamp), s_heirs[estateId].length);
        }
    }

    function recordHeir(uint256 estateId, uint256 heirLabelhash, address heir, uint16 defaultShareBps)
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
        if (s_allocatedDefaultBps[estateId] + defaultShareBps > BPS_DENOMINATOR) {
            revert HeritRegistry__ShareOverflow(s_allocatedDefaultBps[estateId] + defaultShareBps);
        }
        s_heirs[estateId].push(heirLabelhash);
        s_heirAddress[estateId][heirLabelhash] = heir;
        s_defaultShare[estateId][heirLabelhash] = defaultShareBps;
        s_allocatedDefaultBps[estateId] += defaultShareBps;

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
        // TODO: mirror this onto the heir's `herit.share` ENS text record. `AccessControlGate`
        // has no `writeShareRecord` yet, and it cannot have one until the label-vs-labelhash
        // question is settled — `_writeHeirRecords` addresses records by DNS-encoded name, and a
        // labelhash cannot be reversed into the label it came from.
        s_share[estateId][heirLabelhash][token] = bps;
        s_hasOverride[estateId][heirLabelhash][token] = true;

        emit ShareSet(estateId, heirLabelhash, token, bps);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _unlock(uint256 estateId) internal nonReentrant {
        s_estates[estateId].status = Status.Unlocked;

        if (I_GRANTOR_REGISTRY.getExpiry(estateId) <= block.timestamp) {
            I_GATE.renewEstate(estateId, uint64(block.timestamp) + 365 days);
        }

        emit Unlocked(estateId, uint64(block.timestamp), s_heirs[estateId].length);
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
        Estate storage estate = s_estates[estateId];

        // First, before any arithmetic. Unlock is irreversible: once stored, ENS roles are granted
        // and the vault is frozen. No date maths may argue with it.
        if (estate.status == Status.Unlocked) {
            return Status.Unlocked;
        }

        // Not configured, or not started. `Active` and not `Unlocked`: a zero `lastCheckIn` puts
        // the deadline in 1970, which would unlock every estate nobody has set up yet.
        if (estate.checkInInterval == 0 || estate.lastCheckIn == 0) {
            return Status.Active;
        }

        // Widened to `uint256` before adding. Caller-set timers could otherwise wrap a `uint64`
        // into a deadline in the past and unlock a healthy estate.
        uint256 graceStartsAt = uint256(estate.lastCheckIn) + estate.checkInInterval;
        uint256 unlocksAt = graceStartsAt + estate.graceDuration;

        // `graceStartsAt` is the first Grace second, not the last Active one. Same at unlock.
        if (block.timestamp < graceStartsAt) {
            return Status.Active;
        }
        if (block.timestamp < unlocksAt) {
            return Status.Grace;
        }
        return Status.Unlocked;
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @inheritdoc IHeritRegistry
    function statusOf(uint256 estateId) external view returns (Status) {
        return _pendingStatus(estateId);
    }

    // To check whether a label is available for registration,
    function isAvailable(string calldata label) external view returns (bool) {
        IPermissionedRegistry.State memory state = I_GRANTOR_REGISTRY.getState(uint256(keccak256(bytes(label))));
        return state.status == IPermissionedRegistry.Status.AVAILABLE;
    }
}
