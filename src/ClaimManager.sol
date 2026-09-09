// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritVault} from "src/HeritVault.sol";
import {HeritRegistry} from "src/HeritRegistry.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// TO-DO: WRITE RELEVANT INTERFACES FOR ACCESS CONTROL GATE AND HERIT VAULT, THEN IMPORT THEM HERE

contract ClaimManager is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error ClaimManager__ZeroAddress();
    error ClaimManager__NotAttestor();
    error ClaimManager__EstateNotUnlocked(uint256 estateId);
    error ClaimManager__HeirNotFound(uint256 heirLabelhash);
    error ClaimManager__NotEntitled(uint256 estateId, uint256 heirLabelhash, address heir);
    error ClaimManager__InvalidShare(uint256 bps);
    error ClaimManager__NothingToClaim(uint256 estateId, uint256 heirLabelhash);

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    uint256 private constant BPS_DENOMINATOR = 10_000;

    HeritRegistry public immutable I_HERIT_REGISTRY;
    AccessControlGate public immutable I_GATE;
    HeritVault public immutable I_VAULT;
    address public immutable I_ATTESTOR; // liveness attestor contract address

    mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => bool paid))) private s_paid; // Per heir per token // the mapping checks if a perticular user has claimed a particular token. An heir can be entitked to multipkle tokens, but can only claim each token once.

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event Claimed(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, address token, uint256 amount
    );
    event ClaimSettled(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint256 tokenCount
    );

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyAttestor() {
        _onlyAttestor();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(HeritRegistry heritRegistry, AccessControlGate gate, HeritVault vault, address attestor) {
        if (address(heritRegistry) == address(0)) revert ClaimManager__ZeroAddress();
        if (address(gate) == address(0)) revert ClaimManager__ZeroAddress();
        if (address(vault) == address(0)) revert ClaimManager__ZeroAddress();
        if (attestor == address(0)) revert ClaimManager__ZeroAddress();

        I_HERIT_REGISTRY = heritRegistry;
        I_GATE = gate;
        I_VAULT = vault;
        I_ATTESTOR = attestor;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function claim(uint256 estateId, uint256 heirLabelhash, address heir)
        external
        nonReentrant
        onlyAttestor
        returns (uint256 tokensPaid)
    /// @question: this function is supppose to allow heirs ti claim by token too, Right?
    {
        if (I_HERIT_REGISTRY.statusOf(estateId) != IHeritRegistry.Status.Unlocked) {
            revert ClaimManager__EstateNotUnlocked(estateId);
        }
        string memory label = I_HERIT_REGISTRY.heirLabelOf(estateId, heirLabelhash);
        if (bytes(label).length == 0) {
            revert ClaimManager__HeirNotFound(heirLabelhash);
        }
        if (!I_GATE.canClaim(estateId, label, heir)) {
            revert ClaimManager__NotEntitled(estateId, heirLabelhash, heir);
        }
        for (uint256 i = 0; i < I_VAULT.tokensOf(estateId).length; i++) {
            address token = I_VAULT.tokensOf(estateId)[i];
            if (s_paid[estateId][heirLabelhash][token]) continue;
            uint256 bps = I_HERIT_REGISTRY.shareOf(estateId, heirLabelhash, token);
            if (bps == 0) continue; // no share of this asset, therfore, nothing to record.
            if (bps > BPS_DENOMINATOR) revert ClaimManager__InvalidShare(bps);
            s_paid[estateId][heirLabelhash][token] = true;
            uint256 amount = I_VAULT.payOut(estateId, token, heir, uint16(bps)); // forge-lint: disable-next-line(unsafe-typecast)
            tokensPaid++;
            emit Claimed(estateId, heirLabelhash, heir, token, amount);
        }
        if (tokensPaid == 0) {
            revert ClaimManager__NothingToClaim(estateId, heirLabelhash);
        }
        emit ClaimSettled(estateId, heirLabelhash, heir, tokensPaid);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _onlyAttestor() internal view {
        if (msg.sender != I_ATTESTOR) {
            revert ClaimManager__NotAttestor();
        }
    }

    /// @dev The payout sum, kept in one place so the views cannot disagree.
    function _claimable(uint256 estateId, uint256 heirLabelhash, address token) internal view returns (uint256) {
        if (s_paid[estateId][heirLabelhash][token]) {
            return 0;
        }
        uint256 bps = I_HERIT_REGISTRY.shareOf(estateId, heirLabelhash, token);
        if (bps == 0 || bps > BPS_DENOMINATOR) {
            return 0;
        }
        // Same sum as `HeritVault.payOut`, so this shows what actually arrives.
        return (I_VAULT.snapshotOf(estateId, token) * bps) / BPS_DENOMINATOR;
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function hasClaimed(uint256 estateId, uint256 heirLabelhash, address token) external view returns (bool) {
        return s_paid[estateId][heirLabelhash][token];
    }

    /// @notice What one heir can take of one token right now. Zero if paid, if they have no
    ///         share, or before unlock.
    function claimableOf(uint256 estateId, uint256 heirLabelhash, address token) external view returns (uint256) {
        return _claimable(estateId, heirLabelhash, token);
    }

    /// @notice Every token and amount in one read, for the heir dashboard.
    /// @dev Includes tokens worth zero, so the two arrays line up by index.
    function claimableAll(uint256 estateId, uint256 heirLabelhash)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        tokens = I_VAULT.tokensOf(estateId);
        amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            amounts[i] = _claimable(estateId, heirLabelhash, tokens[i]);
        }
    }
}
