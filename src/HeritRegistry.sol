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

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    struct Estate {
        uint64 lastCheckIn;
        uint64 checkInInterval;
        uint64 graceDuration;
        Status status;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    IPermissionedRegistry public immutable I_GRANTOR_REGISTRY; // registry A — who the grantor is
    AccessControlGate public immutable I_GATE;
    HeritVault public immutable I_VAULT;
    address public immutable I_ATTESTOR; /// @question: who is the attestor?       // CREATE2-predicted, Checkpoint 9

    uint16 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_HEIRS = 10; /// @question why are we cappiung the max number of heirs?          // the unlock loop is ENS role grants

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

    function configure(uint256 estateId, uint64 checkInInterval, uint64 graceDuration)
        external
        nonReentrant
        onlyGrantorOf(estateId)
        notUnlocked(estateId)
    {
        if (checkInInterval == 0 || graceDuration == 0) {
            revert HeritRegistry__InvalidTimers();
        }

        Estate storage estate = s_estates[estateId];
        estate.checkInInterval = checkInInterval;
        estate.graceDuration = graceDuration;
        estate.lastCheckIn = uint64(block.timestamp);
        estate.status = Status.ACTIVE;

        emit EstateConfigured(estateId, checkInInterval, graceDuration);
    }

    function checkIn(uint256 estateId) external nonReentrant onlyAttestor {
        Estate storage estate = s_estates[estateId];
        if (estate.lastCheckIn == 0) {
            revert HeritRegistry__NotConfigured(estateId);
        }
        //  check the pending status, not the stored one. Otherwise a grantor whose grace lapsed a week ago, in an estate nobody has poked, could check in and erase the heirs' pending claim.
        if (_pendingStatus(estateId) == Status.UNLOCKED) {
            revert HeritRegistry__EstateUnlocked(estateId);
        }
        estate.lastCheckIn = uint64(block.timestamp);
        estate.status = Status.ACTIVE;

        emit CheckedIn(estateId, estate.lastCheckIn);
    }

    function pokeExpiry(uint256 estateId) external nonReentrant {
        Status pending = _pendingStatus(estateId);
        Status stored = s_estates[estateId].status;
        if (pending == stored) return;
        if (pending == Status.GRACE) {
            s_estates[estateId].status = Status.GRACE;
            emit EnteredGrace(estateId, uint64(block.timestamp));
        } else if (pending == Status.UNLOCKED) {
            s_estates[estateId].status = Status.UNLOCKED;
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
        estateHeirs[estateId].push(heirLabelhash);
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
        if (_totalBps(estateId, token) > BPS_DENOMINATOR) {
            revert HeritRegistry__ShareOverflow(_totalBps(estateId, token));
        }
        I_GATE.writeShareRecord(estateId, heirLabelhash, token, bps);
        s_share[estateId][heirLabelhash][token] = bps;
        s_hasOverride[estateId][heirLabelhash][token] = true;

        emit ShareSet(estateId, heirLabelhash, token, bps);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _unlock(uint256 estateId) internal nonReentrant {}

    function _pendingStatus(uint256 estateId) internal view returns (Status) {}

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    // To check whether a label is available for registration,
    function isAvailable(string calldata label) public view returns (bool) {
        IPermissionedRegistry.State memory state = I_GRANTOR_REGISTRY.getState(uint256(keccak256(bytes(label))));
        return state.status == IPermissionedRegistry.Status.AVAILABLE;
    }
}
