# Checkpoint 9 — LivenessAttestor

A build sheet for `src/LivenessAttestor.sol`, top to bottom in the order the file is laid out.
Signatures and rules only; the bodies are yours.

This is the World half of Herit in one contract. `HeritRegistry.checkIn` and `ClaimManager.claim`
are both `onlyAttestor`, so nothing in the system moves without passing through here first, and
this contract's entire job is to answer one question: **did a real, live human pass a Selfie Check
for this exact action, on this exact estate, recently, and only once?**

It holds no funds, has no owner, no pause and no unsigned fallback. If the signing key is ever
compromised the answer is to redeploy, not to add an override — an override is a second way to
unlock an estate, and a second way to unlock an estate is the thing the whole design is trying not
to have.

---

## 1. What EIP-712 is actually doing here

Plainly: the backend signs a small struct instead of a blob of bytes, and this contract rebuilds
that struct from the arguments it was handed and checks that the signature matches it.

Two things make it work:

- **The domain separator** — a hash of the name `"Herit"`, a version, the chain id, and *this
  contract's address*. It means a signature made for this contract on Sepolia is meaningless
  anywhere else. It also means **every redeploy invalidates every previously signed attestation**,
  because the address changed. Repoint the backend after each deploy; when signatures start failing
  right after a redeploy, this is why, every time.
- **The type hash** — a hash of the struct's shape written out as a string. One renamed field, one
  reordered field, one `uint256` that should have been `uint64`, and the digest differs, `recover`
  returns some unrelated address, and you get "wrong signer" rather than "wrong struct". Nothing
  points at the real cause. So the struct in Solidity and the types object in the backend get
  written once and copied, never retyped.

OpenZeppelin's `EIP712` builds the domain separator and `_hashTypedDataV4` wraps your struct hash
in the `\x19\x01` prefix; `ECDSA.recover` does the recovery and rejects malleable and malformed
signatures. Do not hand-roll either.

---

## 2. Imports

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ClaimManager} from "src/ClaimManager.sol";
import {HeritRegistry} from "src/HeritRegistry.sol";
```

Declare it `contract LivenessAttestor is EIP712`. No `ReentrancyGuard`: both entrypoints mark the
nonce used before they call out, and the two contracts they call are the only ones that can call
back in.

---

## 3. Errors

```solidity
error LivenessAttestor__ZeroAddress();
error LivenessAttestor__InvalidSignature();
error LivenessAttestor__AttestationExpired(uint256 expiry);
error LivenessAttestor__NonceUsed(uint256 nonce);
error LivenessAttestor__WrongAction(bytes32 action);
error LivenessAttestor__SubjectMismatch(address subject, address sender);
error LivenessAttestor__NotTheGrantor(uint256 estateId, address subject);
error LivenessAttestor__WrongHuman(uint256 estateId);
error LivenessAttestor__CommitmentUsed(uint256 estateId, bytes32 commitment);
error LivenessAttestor__ZeroCommitment();
```

`InvalidSignature` carries nothing, the same as `MerkleAirdrop__InvalidSignature`. The address the
signature actually recovered to is still the fastest way to debug a mismatch, so it is exposed as a
view instead — §10.

---

## 4. Type declarations

```solidity
struct Attestation {
    uint256 estateId;
    address subject;        // the grantor checking in, or the heir claiming
    bytes32 action;         // ACTION_CHECKIN or ACTION_CLAIM
    uint256 heirLabelhash;  // zero for a check-in
    bytes32 commitment;     // keccak256(worldIdNullifier, salt), computed in the backend
    uint256 nonce;
    uint256 expiry;         // unix seconds
}

bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
    "Attestation(uint256 estateId,address subject,bytes32 action,uint256 heirLabelhash,bytes32 commitment,uint256 nonce,uint256 expiry)"
);
```

No spaces, no line breaks inside that string, fields in exactly the struct's order.

The digest is built by one public function, `getMessageHash`, which takes the seven fields and
returns what this contract will check:

```solidity
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
        keccak256(abi.encode(ATTESTATION_TYPEHASH, Attestation({ ...the seven fields... })))
    );
}
```

Encoding the struct and encoding the seven fields one by one give the same 32 bytes. Checked, not
assumed: 256 fuzz runs comparing the two. Every field is a fixed-size value type, so the struct
encodes as a plain tuple with no offset word in front of it.

That equality is why the struct must stay all value types. Add a `string` or `bytes` field and it
no longer holds — that field would have to become `keccak256(bytes(x))` inside the encode, and
`abi.encode` of the struct will not do that for you. It is the most common EIP-712 mistake, and it
fails as a wrong signer rather than as anything that names the cause.

Everything else in this contract calls `getMessageHash`. There is one copy of the digest, it is
`public`, and the backend can call it.

---

## 5. State variables

```solidity
bytes32 public constant ACTION_CHECKIN = keccak256("checkin");
bytes32 public constant ACTION_CLAIM   = keccak256("claim");

/// @dev Ceiling on how long a signed attestation stays usable, whatever expiry the backend picked.
uint256 public constant MAX_ATTESTATION_LIFETIME = 30 minutes;

address       public immutable I_SIGNER;           // the backend's attestor EOA
HeritRegistry public immutable I_HERIT_REGISTRY;
ClaimManager  public immutable I_CLAIM_MANAGER;

mapping(uint256 nonce => bool used) private s_nonceUsed;

/// @dev The human bound to this estate's liveness, set by the first check-in. First write wins.
mapping(uint256 estateId => bytes32 commitment) private s_estateCommitment;

/// @dev Claim commitments already spent on this estate. One human, one claim.
mapping(uint256 estateId => mapping(bytes32 commitment => bool used)) private s_claimUsed;
```

A single global nonce mapping, not one per subject. The backend issues them, so they are unique by
construction, and a global map is one storage slot per attestation either way.

---

## 6. Events

```solidity
event EstateBound(uint256 indexed estateId, bytes32 commitment);
event CheckInAttested(uint256 indexed estateId, address indexed subject, uint256 nonce);
event ClaimAttested(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed subject, uint256 nonce);
```

`EstateBound` fires once in an estate's life. It is the moment a person, rather than a key, becomes
the estate's proof of life — worth having on chain for the video.

---

## 7. Constructor

```solidity
constructor(address signer, HeritRegistry heritRegistry, ClaimManager claimManager)
    EIP712("Herit", "1")
```

Revert `ZeroAddress` on any zero, then assign all three `immutable`.

`"Herit"` and `"1"` are part of the domain separator, so they are part of the protocol. The backend
signs with exactly these two strings. Do not "tidy" them later.

Deploy order is in Checkpoint 8 §6: this is the last of the five, at nonce `n+4`, and both
addresses it takes already exist by then, so nothing here is predicted. It is what `HeritRegistry`
and `ClaimManager` predicted.

---

## 8. The two external functions

Both take the same two arguments and share one internal verifier.

```solidity
function checkIn(Attestation calldata a, uint8 v, bytes32 r, bytes32 s) external;
function claim(Attestation calldata a, uint8 v, bytes32 r, bytes32 s) external;
```

Split `v, r, s`, like `MerkleAirdrop.claim`, not a packed `bytes`. The contract does no length or
slicing work, and the frontend splits the backend's 65-byte signature before sending — viem's
`parseSignature`, or `ethers.Signature.from`.

### `_verify(Attestation calldata a, uint8 v, bytes32 r, bytes32 s, bytes32 expectedAction)`

Shared, internal, and it **writes** — it burns the nonce. Order matters, cheapest and most likely
to fail first:

1. `a.action == expectedAction`, else `WrongAction`. Without this one check a claim attestation is
   a valid check-in and an heir can keep the estate alive forever, or the grantor can claim as an
   heir. It is one comparison and it is the reason the action field exists.
2. `a.expiry > block.timestamp`, else `AttestationExpired`. Also
   `a.expiry <= block.timestamp + MAX_ATTESTATION_LIFETIME` — a backend bug that signs a
   ten-year expiry should fail here rather than sit in someone's inbox as a decade-long licence to
   check in.
3. `a.subject == msg.sender`, else `SubjectMismatch`. The user sends their own transaction, so the
   attestation is bound to them. Without it, an attestation is a bearer token: anyone who sees one
   in the mempool or in a frontend log can replay it as themselves.
4. `a.commitment != bytes32(0)`, else `ZeroCommitment`. A backend that fails to read the nullifier
   and signs zeros would otherwise bind every estate to the same "human".
5. The signature, else `InvalidSignature`:
   ```solidity
   bytes32 digest = getMessageHash(
       a.estateId, a.subject, a.action, a.heirLabelhash, a.commitment, a.nonce, a.expiry
   );
   if (!_isValidSignature(I_SIGNER, digest, v, r, s)) revert LivenessAttestor__InvalidSignature();
   ```
6. `!s_nonceUsed[a.nonce]`, else `NonceUsed`; then `s_nonceUsed[a.nonce] = true`. **Burn it here**,
   before either caller reaches its external call.

### `_isValidSignature(address expectedSigner, bytes32 digest, uint8 v, bytes32 r, bytes32 s)`

`internal pure returns (bool)`, the same three lines as `MerkleAirdrop._isValidSignature`:

```solidity
(address actualSigner,,) = ECDSA.tryRecover(digest, v, r, s);
return actualSigner == expectedSigner;
```

`tryRecover` rather than `recover` because it returns instead of reverting, so the caller chooses
the error. Checked in the OZ 5.7 source: this overload rejects a high `s` (the malleable half of
every signature) and returns `address(0)` on any failure. The zero return is only safe because
`I_SIGNER` can never be zero — the constructor rejects it. Keep that check.

### `checkIn`

1. `_verify(a, v, r, s, ACTION_CHECKIN)`.
2. **The subject must be the estate's grantor.** The registry does not check this — it trusts
   whoever this contract forwards — so it has to be checked here:
   ```solidity
   if (I_HERIT_REGISTRY.I_GRANTOR_REGISTRY().getOwner(a.estateId) != a.subject) {
       revert LivenessAttestor__NotTheGrantor(a.estateId, a.subject);
   }
   ```
   No extra constructor argument needed: `I_GRANTOR_REGISTRY` is a public immutable on the registry.
3. **Bind or match the human.** If `s_estateCommitment[a.estateId] == 0`, store `a.commitment` and
   emit `EstateBound`. Otherwise require it equals the stored one, else `WrongHuman`.
4. `I_HERIT_REGISTRY.checkIn(a.estateId);`
5. `emit CheckInAttested(...)`.

### `claim`

1. `_verify(a, v, r, s, ACTION_CLAIM)`.
2. `s_claimUsed[a.estateId][a.commitment]` must be false, else `CommitmentUsed`; set it true.
3. Optional, and worth a sentence in the video: reject a claim whose commitment equals
   `s_estateCommitment[a.estateId]` — that is the grantor claiming from their own estate as one of
   their heirs.
4. `I_CLAIM_MANAGER.claim(a.estateId, a.heirLabelhash, a.subject);`
5. `emit ClaimAttested(...)`.

Both functions are CHECKS then EFFECTS then INTERACTIONS, and worth marking that way as in
`MerkleAirdrop.claim`: `_verify` and the grantor check are checks, the nonce burn and the
commitment write are effects, and the call into `HeritRegistry` or `ClaimManager` is the single
interaction at the end.

Note what is *not* here: whether `a.subject` is really an heir, what their share is, whether they
were already paid. `ClaimManager` and ENS answer all three, and duplicating any of them here would
create a second opinion.

---

## 9. Step 3 of `checkIn` is the interesting part

The commitment is a salted World ID nullifier. A nullifier is stable **per human per action**, so
the same person checking in next month produces the same commitment, and a different person
produces a different one — no matter whose private key sends the transaction.

That is what makes this different from a `lastActive` timestamp. A thief with the grantor's key
can sign anything, but they cannot make the backend's Cloud Verify call return the grantor's
nullifier, because they are not the grantor. Their check-in fails on `WrongHuman`, and the estate
runs down its clock and unlocks to the heirs exactly as intended.

First write wins, so **the grantor's first check-in is what claims the estate**. Do it in the setup
flow, in the same session as `configure`, not "later". On chain, step 2 above closes the gap
anyway: only the address that owns the estate name can bind it.

The salt is why the commitment is hashed rather than stored raw. A raw nullifier on chain is the
same value for that human in every estate they ever touch, which makes an anonymous credential into
a public identifier. The salt never leaves the backend.

---

## 10. Views the backend and the frontend need

`getMessageHash` from §4 is already one of these, and the important one: it turns "wrong signer"
into a real answer in one `cast call`, because the backend can ask the contract for the digest it
expects and compare byte for byte. Keep it `public`. The rest:

```solidity
/// @notice Who a signature actually recovers to. For debugging a mismatch.
function recoverSigner(bytes32 digest, uint8 v, bytes32 r, bytes32 s) external pure returns (address);

function nonceUsed(uint256 nonce) external view returns (bool);
function commitmentOf(uint256 estateId) external view returns (bytes32);
function claimCommitmentUsed(uint256 estateId, bytes32 commitment) external view returns (bool);
```

`recoverSigner` is what `InvalidSignature` no longer tells you. Noise means the digest is wrong;
a plausible address means the key is wrong. Two different afternoons.

`EIP712` also gives you `eip712Domain()` free (ERC-5267), which returns the name, version, chain id
and verifying contract — that is what the backend reads to build its domain rather than being told
them twice.

The domain and types the backend signs, which must match §4 character for character:

```js
domain: { name: "Herit", version: "1", chainId: 11155111, verifyingContract: <attestor> }
types: { Attestation: [
  { name: "estateId",      type: "uint256" },
  { name: "subject",       type: "address" },
  { name: "action",        type: "bytes32" },
  { name: "heirLabelhash", type: "uint256" },
  { name: "commitment",    type: "bytes32" },
  { name: "nonce",         type: "uint256" },
  { name: "expiry",        type: "uint256" },
]}
```

---

## 11. Do it in this order

1. §2–§7 — imports through constructor, plus `getMessageHash` and `_isValidSignature`.
   `forge build`, then in a Foundry test `(uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey,
   getMessageHash(...))` and check `_isValidSignature` returns true. Get that green before writing
   anything else; everything below assumes the digest is right.
2. `_verify`, all six checks.
3. `checkIn`, including the grantor check and the bind-or-match.
4. `claim`.
5. The remaining views. `forge fmt`, `forge build --sizes`.

Step 1 is where the whole checkpoint either goes smoothly or eats an afternoon.

---

## 12. You are done when

- `forge fmt --check` and `forge build --sizes` are clean and every existing test still passes.
- A signed check-in moves `HeritRegistry.lastCheckIn`, and the same attestation sent twice reverts
  `NonceUsed`.
- A claim attestation passed to `checkIn` reverts `WrongAction`, and vice versa.
- A second check-in with a different commitment reverts `WrongHuman` — this is the demo's "the
  thief has the key and still cannot check in" moment.
- Someone other than `a.subject` sending a valid attestation reverts `SubjectMismatch`.
- A signature signed by any other key reverts `InvalidSignature`, and an expired one reverts
  `AttestationExpired`.
- You can say in one sentence why the nullifier is salted. That answer is worth points with the
  World judges, and it is the last line of Checkpoint 10.

Say the word and I will write the spec-first test suite, including a `vm.sign`-based attestation
helper the later tests and the demo script can both reuse.
