// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";

/**
 * @title HeritVault
 * @author Kelechi Kizito Ugwu
 * @notice Escrow holding a grantor's willed ETH and ERC20s until their estate unlocks. One vault
 *         serves every estate, keyed by estate id.
 * @dev Two numbers per token: the balance, which is the money held, and the snapshot, which is what
 *      that balance was at unlock. Shares come off the snapshot, money comes out of the balance, so
 *      heirs claiming at different times split the same total.
 * @dev Knows nothing about heirs. `AccessControlGate` owns who they are, `HeritRegistry` their
 *      shares, `ClaimManager` whether one has been paid.
 */
contract HeritVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error HeritVault__ZeroAddress();
    error HeritVault__NotGrantor();
    error HeritVault__NotHeritRegistry();
    error HeritVault__NotClaimManager();
    error HeritVault__ZeroAmount();
    error HeritVault__InsufficientBalance(uint256 requested, uint256 available);
    error HeritVault__ShareTooLarge(uint16 shareBps);
    error HeritVault__EthTransferFailed(address to, uint256 amount);
    /// @dev Registry A has no owner for this estate: never opened, or its name has lapsed.
    error HeritVault__EstateNotFound(uint256 estateId);
    /// @dev The snapshot is taken and the assets are spoken for. Deposits and withdrawals are closed.
    error HeritVault__EstateUnlocked(uint256 estateId);
    error HeritVault__SnapshotNotTaken(uint256 estateId);
    error HeritVault__TooManyTokens(uint256 maxTokens);
    /// @dev ETH is deposited through `depositETH`; this path is for ERC20s only.
    error HeritVault__NotAnErc20();

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev The key ETH is filed under. `HeritRegistry` and `ClaimManager` must use the same one.
    address public constant NATIVE = address(0);

    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @dev Ceiling on distinct tokens per estate, counting ETH. `snapshot` loops the whole list, so
    ///      an unbounded one could make the unlock transition run out of gas and strand the estate.
    uint256 public constant MAX_TOKENS = 10;

    /// @dev Registry A. Asked one question: who owns this estate's name, i.e. who the grantor is.
    IPermissionedRegistry public immutable I_GRANTOR_REGISTRY;

    /// @dev Read for status, and the only caller permitted to snapshot.
    IHeritRegistry public immutable I_HERIT_REGISTRY;

    /// @dev The only caller permitted to move money out. An `address` rather than a typed reference
    ///      because it is CREATE2-predicted and passed in before `ClaimManager` exists.
    address public immutable I_CLAIM_MANAGER;

    mapping(uint256 estateId => mapping(address token => uint256 amount)) private s_balances;

    /// @dev What each balance was at unlock. Every share is a percentage of this and nothing else.
    mapping(uint256 estateId => mapping(address token => uint256 amount)) private s_snapshots;

    /// @dev Every token an estate has held, because a mapping cannot be iterated and `snapshot` has
    ///      to visit all of them. Never pruned: a token withdrawn to zero snapshots as zero.
    mapping(uint256 estateId => address[] tokens) private s_tokens;

    mapping(uint256 estateId => mapping(address token => bool listed)) private s_listed;

    mapping(uint256 estateId => bool taken) private s_snapshotTaken;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposited(uint256 indexed estateId, address indexed token, address indexed from, uint256 amount);
    event Withdrawn(uint256 indexed estateId, address indexed token, address indexed to, uint256 amount);
    event Snapshotted(uint256 indexed estateId, uint256 tokenCount);
    event PaidOut(uint256 indexed estateId, address indexed token, address indexed to, uint16 shareBps, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyGrantorOf(uint256 estateId) {
        _onlyGrantorOf(estateId);
        _;
    }

    modifier onlyHeritRegistry() {
        _onlyHeritRegistry();
        _;
    }

    modifier onlyClaimManager() {
        _onlyClaimManager();
        _;
    }

    /// @dev Only `Unlocked` closes the doors. `Grace` is the false-alarm window: the grantor is
    ///      presumed alive and their money stays theirs.
    modifier notUnlocked(uint256 estateId) {
        _notUnlocked(estateId);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param grantorRegistry Registry A, where estate names live. Supplies the grantor address.
    /// @param heritRegistry The estate state machine, and the only caller permitted to snapshot.
    /// @param claimManager The only caller permitted to pay an heir.
    /// @dev Both of the latter take this vault in their own constructors, so both are CREATE2-
    ///      predicted. `immutable` fixes them in bytecode with no setter to repoint them.
    constructor(IPermissionedRegistry grantorRegistry, IHeritRegistry heritRegistry, address claimManager) {
        if (
            address(grantorRegistry) == address(0) || address(heritRegistry) == address(0) || claimManager == address(0)
        ) {
            revert HeritVault__ZeroAddress();
        }
        I_GRANTOR_REGISTRY = grantorRegistry;
        I_HERIT_REGISTRY = heritRegistry;
        I_CLAIM_MANAGER = claimManager;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposits ETH into an estate. Grantor only, and only before unlock.
    function depositETH(uint256 estateId) external payable onlyGrantorOf(estateId) notUnlocked(estateId) {
        if (msg.value == 0) {
            revert HeritVault__ZeroAmount();
        }

        _listToken(estateId, NATIVE);
        s_balances[estateId][NATIVE] += msg.value;

        emit Deposited(estateId, NATIVE, msg.sender, msg.value);
    }

    /// @notice Deposits an ERC20 into an estate. Grantor only, and only before unlock.
    /// @param token Must already be approved to this vault by the grantor.
    /// @param amount The amount to pull. What is credited is what arrives, which can be less.
    function depositERC20(uint256 estateId, address token, uint256 amount)
        external
        nonReentrant
        onlyGrantorOf(estateId)
        notUnlocked(estateId)
    {
        if (token == NATIVE) {
            revert HeritVault__NotAnErc20();
        }
        if (amount == 0) {
            revert HeritVault__ZeroAmount();
        }

        // Credit the measured delta, not `amount`. A fee-on-transfer token delivers less than asked,
        // and crediting the request leaves the books richer than the vault — paid for by whoever
        // claims last.
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 credited = IERC20(token).balanceOf(address(this)) - balanceBefore;

        if (credited == 0) {
            revert HeritVault__ZeroAmount();
        }

        _listToken(estateId, token);
        s_balances[estateId][token] += credited;

        emit Deposited(estateId, token, msg.sender, credited);
    }

    /// @notice Takes assets back out. Grantor only, and only before unlock.
    /// @dev A will you cannot change is a bad will. Also the way out for a grantor who returns
    ///      during `Grace` after a missed check-in.
    function withdraw(uint256 estateId, address token, uint256 amount)
        external
        nonReentrant
        onlyGrantorOf(estateId)
        notUnlocked(estateId)
    {
        _debit(estateId, token, amount);
        _send(token, msg.sender, amount);

        emit Withdrawn(estateId, token, msg.sender, amount);
    }

    /// @notice Freezes every balance the estate holds. Called by `HeritRegistry` on the unlock transition.
    /// @dev On the transition, not on the first claim: a deposit landing in between would change the
    ///      total later shares are measured against.
    function snapshot(uint256 estateId) external onlyHeritRegistry {
        // A no-op rather than a revert, because `pokeExpiry` is permissionless and two callers can
        // poke in the same block. Re-running it after a payout would shrink the ruler.
        if (s_snapshotTaken[estateId]) {
            return;
        }
        s_snapshotTaken[estateId] = true;

        address[] memory tokens = s_tokens[estateId];
        for (uint256 i = 0; i < tokens.length; i++) {
            s_snapshots[estateId][tokens[i]] = s_balances[estateId][tokens[i]];
        }

        emit Snapshotted(estateId, tokens.length);
    }

    /// @notice Pays one heir their share of one asset. `ClaimManager` only.
    /// @return amount What was actually sent, for the caller's event.
    /// @dev Does not know who `to` is, whether they have been paid, or whether they hold the ENS
    ///      claim role. `ClaimManager` answers all three before calling.
    function payOut(uint256 estateId, address token, address to, uint16 shareBps)
        external
        nonReentrant
        onlyClaimManager
        returns (uint256 amount)
    {
        if (to == address(0)) {
            revert HeritVault__ZeroAddress();
        }
        if (shareBps > BPS_DENOMINATOR) {
            revert HeritVault__ShareTooLarge(shareBps);
        }
        if (!s_snapshotTaken[estateId]) {
            revert HeritVault__SnapshotNotTaken(estateId);
        }

        // Percentage off the snapshot, money out of the balance. Truncation leaves dust, which beats
        // paying out more than was there.
        amount = (s_snapshots[estateId][token] * shareBps) / BPS_DENOMINATOR;
        if (amount == 0) {
            return 0;
        }

        _debit(estateId, token, amount);
        _send(token, to, amount);

        emit PaidOut(estateId, token, to, shareBps, amount);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Lists a token the first time it is seen. The cap is on the list, not on the money:
    ///      topping up a listed token is always allowed.
    function _listToken(uint256 estateId, address token) internal {
        if (s_listed[estateId][token]) {
            return;
        }
        if (s_tokens[estateId].length >= MAX_TOKENS) {
            revert HeritVault__TooManyTokens(MAX_TOKENS);
        }
        s_listed[estateId][token] = true;
        s_tokens[estateId].push(token);
    }

    /// @dev Runs before the money moves, so a recipient calling back in finds the balance reduced.
    function _debit(uint256 estateId, address token, uint256 amount) internal {
        uint256 available = s_balances[estateId][token];
        if (amount > available) {
            revert HeritVault__InsufficientBalance(amount, available);
        }
        s_balances[estateId][token] = available - amount;
    }

    /// @dev ETH goes out with `call`, not `transfer`: 2300 gas is not enough for a contract wallet
    ///      to accept a payment, and plenty of heirs use one.
    function _send(address token, address to, uint256 amount) internal {
        if (token == NATIVE) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) {
                revert HeritVault__EthTransferFailed(to, amount);
            }
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /// @dev The grantor is whoever owns the estate's name in registry A, so there is no second copy
    ///      to keep in step. A lapsed name reads as zero until `AccessControlGate.renewEstate`.
    function _onlyGrantorOf(uint256 estateId) internal view {
        address grantor = I_GRANTOR_REGISTRY.getOwner(estateId);
        if (grantor == address(0)) {
            revert HeritVault__EstateNotFound(estateId);
        }
        if (msg.sender != grantor) {
            revert HeritVault__NotGrantor();
        }
    }

    function _onlyHeritRegistry() internal view {
        if (msg.sender != address(I_HERIT_REGISTRY)) {
            revert HeritVault__NotHeritRegistry();
        }
    }

    function _onlyClaimManager() internal view {
        if (msg.sender != I_CLAIM_MANAGER) {
            revert HeritVault__NotClaimManager();
        }
    }

    /// @dev Asks `HeritRegistry` rather than keeping a copy of the status here.
    function _notUnlocked(uint256 estateId) internal view {
        if (I_HERIT_REGISTRY.statusOf(estateId) == IHeritRegistry.Status.Unlocked) {
            revert HeritVault__EstateUnlocked(estateId);
        }
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice What an estate currently holds of one asset.
    /// @dev Not `address(this).balance` or `balanceOf(this)`: those sum every estate in the vault,
    ///      plus any ETH forced in from outside, which belongs to none of them.
    function balanceOf(uint256 estateId, address token) external view returns (uint256) {
        return s_balances[estateId][token];
    }

    /// @notice What an estate held of one asset at unlock. Zero before then.
    function snapshotOf(uint256 estateId, address token) external view returns (uint256) {
        return s_snapshots[estateId][token];
    }

    /// @notice Every asset an estate has held, in the order first deposited.
    function tokensOf(uint256 estateId) external view returns (address[] memory) {
        return s_tokens[estateId];
    }

    /// @notice Whether this estate's balances have been frozen.
    function snapshotTaken(uint256 estateId) external view returns (bool) {
        return s_snapshotTaken[estateId];
    }
}
