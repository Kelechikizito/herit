// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ClaimManager} from "src/ClaimManager.sol";
import {HeritRegistry} from "src/HeritRegistry.sol";

contract LivenessAttestor is EIP712 {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error LivenessAttestor__ZeroAddress();
    error LivenessAttestor__InvalidSigner(address recovered);
    error LivenessAttestor__InvalidSignature();
    error LivenessAttestor__AttestationExpired(uint256 expiry);
    error LivenessAttestor__NonceUsed(uint256 nonce);
    error LivenessAttestor__WrongAction(bytes32 action);
    error LivenessAttestor__SubjectMismatch(address subject, address sender);
    error LivenessAttestor__NotTheGrantor(uint256 estateId, address subject);
    error LivenessAttestor__WrongHuman(uint256 estateId);
    error LivenessAttestor__CommitmentUsed(uint256 estateId, bytes32 commitment);
    error LivenessAttestor__ZeroCommitment();

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    struct Attestation {
        uint256 estateId;
        address subject; // the grantor checking in, or the heir claiming
        bytes32 action; // ACTION_CHECKIN or ACTION_CLAIM
        uint256 heirLabelhash; // zero for a check-in
        bytes32 commitment; // keccak256(worldIdNullifier, salt), computed in the backend
        uint256 nonce;
        uint256 expiry; // unix seconds
    }

    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(uint256 estateId,address subject,bytes32 action,uint256 heirLabelhash,bytes32 commitment,uint256 nonce,uint256 expiry)"
    );

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant ACTION_CHECKIN = keccak256("checkin");
    bytes32 public constant ACTION_CLAIM = keccak256("claim");

    /// @dev Ceiling on how long a signed attestation stays usable, whatever expiry the backend picked.
    uint256 public constant MAX_ATTESTATION_LIFETIME = 30 minutes;

    address public immutable I_SIGNER; // the backend's attestor EOA
    HeritRegistry public immutable I_HERIT_REGISTRY;
    ClaimManager public immutable I_CLAIM_MANAGER;

    mapping(uint256 nonce => bool used) private s_nonceUsed;

    /// @dev The human bound to this estate's liveness, set by the first check-in. First write wins.
    mapping(uint256 estateId => bytes32 commitment) private s_estateCommitment;

    /// @dev Claim commitments already spent on this estate. One human, one claim.
    mapping(uint256 estateId => mapping(bytes32 commitment => bool used)) private s_claimUsed;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event EstateBound(uint256 indexed estateId, bytes32 commitment);
    event CheckInAttested(uint256 indexed estateId, address indexed subject, uint256 nonce);
    event ClaimAttested(
        uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed subject, uint256 nonce
    );

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address signer, HeritRegistry heritRegistry, ClaimManager claimManager) EIP712("Herit", "1") {
        if (signer == address(0)) revert LivenessAttestor__ZeroAddress();
        if (address(heritRegistry) == address(0)) revert LivenessAttestor__ZeroAddress();
        if (address(claimManager) == address(0)) revert LivenessAttestor__ZeroAddress();

        I_SIGNER = signer;
        I_HERIT_REGISTRY = heritRegistry;
        I_CLAIM_MANAGER = claimManager;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    // @questi
    function checkIn(Attestation calldata a, bytes calldata signature) external {
        // The subject must be the estate's grantor.
        if (I_HERIT_REGISTRY.I_GRANTOR_REGISTRY().getOwner(a.estateId) != a.subject) {
            revert LivenessAttestor__NotTheGrantor(a.estateId, a.subject);
        }

        bytes32 bound = s_estateCommitment[a.estateId];
        if (bound != bytes32(0) && bound != a.commitment) {
            revert LivenessAttestor__WrongHuman(a.estateId);
        }

        _verify(a, signature, ACTION_CHECKIN);

        if (bound == bytes32(0)) {
            s_estateCommitment[a.estateId] = a.commitment;
        }

        I_HERIT_REGISTRY.checkIn(a.estateId);

        if (bound == bytes32(0)) {
            emit EstateBound(a.estateId, a.commitment);
        }
        emit CheckInAttested(a.estateId, a.subject, a.nonce);
    }

    function claim(Attestation calldata a, bytes calldata signature) external {
        if (s_claimUsed[a.estateId][a.commitment]) {
            revert LivenessAttestor__CommitmentUsed(a.estateId, a.commitment);
        }
        if (s_estateCommitment[a.estateId] == a.commitment) {
            revert LivenessAttestor__WrongHuman(a.estateId);
        }

        _verify(a, signature, ACTION_CLAIM);

        s_claimUsed[a.estateId][a.commitment] = true;

        I_CLAIM_MANAGER.claim(a.estateId, a.heirLabelhash, a.subject);

        emit ClaimAttested(a.estateId, a.heirLabelhash, a.subject, a.nonce);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _verify(Attestation calldata a, bytes calldata signature, bytes32 expectedAction) internal returns (bool) {
        if (a.action != expectedAction) revert LivenessAttestor__WrongAction(a.action);
        if (a.expiry < block.timestamp) revert LivenessAttestor__AttestationExpired(a.expiry);
        if (a.expiry > block.timestamp + MAX_ATTESTATION_LIFETIME) {
            revert LivenessAttestor__AttestationExpired(a.expiry);
        }
        if (a.subject != msg.sender) revert LivenessAttestor__SubjectMismatch(a.subject, msg.sender);
        if (a.commitment == bytes32(0)) revert LivenessAttestor__ZeroCommitment();
        bytes32 digest =
            getMessageHash(a.estateId, a.subject, a.action, a.heirLabelhash, a.commitment, a.nonce, a.expiry);
        if (ECDSA.recover(digest, signature) != I_SIGNER) revert LivenessAttestor__InvalidSignature();
        if (s_nonceUsed[a.nonce]) {
            revert LivenessAttestor__NonceUsed(a.nonce);
        }
        s_nonceUsed[a.nonce] = true;
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Returns the hash of the attestation that is used for signing.
     * @param estateId The ID of the estate.
     * @param subject The address of the subject.
     * @param action The action being performed.
     * @param heirLabelhash The hash of the heir label.
     * @param commitment The commitment hash.
     * @param nonce The nonce for the attestation.
     * @param expiry The expiry time for the attestation.
     * @return bytes32 Returns the hash of the attestation.
     */
    function getMessageHash(
        uint256 estateId,
        address subject,
        bytes32 action,
        uint256 heirLabelhash,
        bytes32 commitment,
        uint256 nonce,
        uint256 expiry
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    Attestation({
                        estateId: estateId,
                        subject: subject,
                        action: action,
                        heirLabelhash: heirLabelhash,
                        commitment: commitment,
                        nonce: nonce,
                        expiry: expiry
                    })
                )
            )
        );
    }

    function nonceUsed(uint256 nonce) external view returns (bool) {
        return s_nonceUsed[nonce];
    }

    function commitmentOf(uint256 estateId) external view returns (bytes32) {
        return s_estateCommitment[estateId];
    }

    function claimCommitmentUsed(uint256 estateId, bytes32 commitment) external view returns (bool) {
        return s_claimUsed[estateId][commitment];
    }
}
