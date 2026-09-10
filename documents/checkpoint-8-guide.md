# Checkpoint 8 — ClaimManager

A build sheet for `src/ClaimManager.sol`, top to bottom in the order the file is laid out.
Signatures and rules only; the bodies are yours.

This is the last contract that moves money, and it is the smallest of the four. Everything it
needs is already built and already answers questions:

| It asks | Of | And gets |
|---|---|---|
| Has this estate unlocked? | `HeritRegistry.statusOf` | a `Status` |
| Is this person actually an heir with rights? | `AccessControlGate.canClaim` | a `bool`, read out of ENS |
| What is their share of this asset? | `HeritRegistry.shareOf` | basis points |
| Which assets does the estate hold? | `HeritVault.tokensOf` | an address list |
| Pay them | `HeritVault.payOut` | the amount sent |

So `ClaimManager` decides nothing on its own. It owns exactly one piece of state that nobody
else has: **who has already been paid, for which asset**. Keep it that way — every time you feel
the urge to store an heir, a share or a status here, that number already lives somewhere else and
a second copy is a bug waiting for a demo audience.

`HeritVault.payOut` is `onlyClaimManager` and takes a CREATE-predicted address, so the vault is
already waiting for this contract to exist.

---

## 1. Imports

```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritRegistry} from "src/HeritRegistry.sol";
import {HeritVault} from "src/HeritVault.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
```

The concrete `HeritRegistry`, not the interface: you need `shareOf`, `heirLabelOf` and `heirsOf`,
and `IHeritRegistry` only carries `recordHeir` and `statusOf`. `IHeritRegistry` still comes in for
the `Status` enum.

---

## 2. Errors

```solidity
error ClaimManager__ZeroAddress();
error ClaimManager__NotAttestor();
error ClaimManager__EstateNotUnlocked(uint256 estateId);
error ClaimManager__HeirNotFound(uint256 heirLabelhash);
error ClaimManager__NotEntitled(uint256 estateId, uint256 heirLabelhash, address heir);
error ClaimManager__InvalidShare(uint256 bps);
error ClaimManager__NothingToClaim(uint256 estateId, uint256 heirLabelhash);
```

`NotEntitled` is the one that will fire most during the demo build. Give it all three arguments —
when it reverts you want to see immediately whether you passed the wrong labelhash or the wrong
address, because those two mistakes look identical otherwise.

---

## 3. State variables

```solidity
uint256 private constant BPS_DENOMINATOR = 10_000;

HeritRegistry     public immutable I_HERIT_REGISTRY;
AccessControlGate public immutable I_GATE;
HeritVault        public immutable I_VAULT;
address           public immutable I_ATTESTOR;   // predicted, Checkpoint 9

/// The only state this contract owns.
mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => bool paid)))
    private s_paid;
```

Per heir **per token**, not per heir. An heir who takes their ETH today and their USDC next week
has claimed once in each column, and a single `bool` per heir would either pay them twice or lock
them out of the second asset.

---

## 4. Events

```solidity
event Claimed(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, address token, uint256 amount);
event ClaimSettled(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint256 tokenCount);
```

`HeritVault` already emits `PaidOut` for each transfer, so `Claimed` is not strictly needed. Emit
it anyway: the vault's event is keyed by address and this one is keyed by heir, and the second is
what the frontend and the video can actually follow.

---

## 5. Modifiers

```solidity
modifier onlyAttestor() { _onlyAttestor(); _; }
```

Same wrapped shape as the vault and the registry, for the same lint reason.

Only the attestor, deliberately. An heir cannot call this directly even holding the ENS role,
because the ENS role proves *authority* and the attestation proves *personhood* — the sybil gate
is the whole reason the World half exists. If you want a bypass for local testing, get it by
constructing the contract with your EOA as `attestor` in a test, not by adding a second entrypoint.

---

## 6. Constructor, and how these five contracts get deployed

```solidity
constructor(HeritRegistry heritRegistry, AccessControlGate gate, HeritVault vault, address attestor)
```

Revert `ClaimManager__ZeroAddress` on any zero, then assign. All four `immutable`.

**A correction to Checkpoint 7.** I said the predicted addresses would be CREATE2. They cannot be.
A CREATE2 address depends on the creation code *including the constructor arguments*, and here the
arguments are each other: the vault takes the registry, the registry takes the vault. Each address
would need the other's address to be computed first. There is no ordering that resolves it.

Plain `CREATE` has no such problem, because a contract's address is only `keccak256(deployer,
nonce)` — the arguments are not in it. So `script/DeployHerit.s.sol` (mine to write) predicts by
nonce:

```
n     AccessControlGate      takes HeritRegistry            → predict n+1
n+1   HeritRegistry          takes gate, vault, attestor    → predict n+2, n+3
n+2   HeritVault             takes registry, claimManager   → predict n+3
n+3   ClaimManager           takes registry, gate, vault, attestor → predict n+4
n+4   LivenessAttestor       takes registry, claimManager
```

Every address is `vm.computeCreateAddress(deployer, nonce)`, asserted against the real address
after each deployment so a mismatch stops the script rather than producing a set of contracts that
point at nothing. The gate is redeployed because the one on Sepolia points its `I_HERIT_REGISTRY`
at your EOA; the two root-role grants get re-run against the new gate. **Registry A, the resolver
and `herit.eth` are untouched** — they hold no reference to any of these five.

---

## 7. The one external function

### `claim(uint256 estateId, uint256 heirLabelhash, address heir)`

`onlyAttestor`, `nonReentrant`. Returns the number of assets actually paid.

```solidity
function claim(uint256 estateId, uint256 heirLabelhash, address heir)
    external
    nonReentrant
    onlyAttestor
    returns (uint256 tokensPaid);
```

In order:

1. **Status.** `I_HERIT_REGISTRY.statusOf(estateId) == Status.Unlocked`, else
   `EstateNotUnlocked`. Read §8 before you decide what this check is worth — it is a friendly
   error message, not the gate.
2. **Label.** `string memory label = I_HERIT_REGISTRY.heirLabelOf(estateId, heirLabelhash);` and
   revert `HeirNotFound` if it is empty (`bytes(label).length == 0`). The gate addresses ENS by
   name, and a labelhash cannot be turned back into one, so the registry's stored label is the only
   way to ask the question.
3. **The real gate.** `I_GATE.canClaim(estateId, label, heir)`, else `NotEntitled`. Passing a
   `string memory` into a `string calldata` parameter is fine here — it is an external call, so the
   argument is ABI-encoded on the way out.
4. **Loop `I_VAULT.tokensOf(estateId)`**, at most `MAX_TOKENS` = 10 long. For each token:
   - `if (s_paid[estateId][heirLabelhash][token]) continue;`
   - `uint256 bps = I_HERIT_REGISTRY.shareOf(estateId, heirLabelhash, token);`
   - `if (bps == 0) continue;` — no share of this asset, and nothing to record.
   - `if (bps > BPS_DENOMINATOR) revert ClaimManager__InvalidShare(bps);` The registry returns a
     `uint256` and the vault takes a `uint16`. Check before you cast, or a bad number becomes a
     different, smaller, legal-looking number.
   - **Mark paid, then pay.** `s_paid[...] = true;` and only then
     `uint256 amount = I_VAULT.payOut(estateId, token, heir, uint16(bps));`
   - `tokensPaid++` and emit `Claimed`.
5. `if (tokensPaid == 0) revert NothingToClaim(estateId, heirLabelhash);` — an heir who is fully
   paid should get a clear revert rather than a successful transaction that did nothing and burned
   their attestation nonce.
6. `emit ClaimSettled(estateId, heirLabelhash, heir, tokensPaid);`

Everything in one call, all assets at once. Per-token flags still, because a claim that reverts
part-way through would otherwise be unresumable, and because the frontend wants to show a per-asset
ledger.

---

## 8. Four traps

**`statusOf` returns the *pending* status, not the stored one.** You implemented it as
`_pendingStatus`, so it flips to `Unlocked` the instant the clock passes — before anyone called
`pokeExpiry`, before the vault snapshot, before a single ENS role was granted. Step 1 above is
therefore a courtesy, not a gate. The two things that genuinely cannot be true until `_unlock` has
run are `canClaim` (the role does not exist yet) and the vault snapshot (`payOut` reverts
`SnapshotNotTaken`). Both are downstream of step 1, so an unpoked estate fails safely — it just
fails with a worse error message. If that bothers you, add
`if (!I_VAULT.snapshotTaken(estateId)) revert EstateNotUnlocked(estateId);` next to step 1 and the
message stays honest.

**Mark paid before calling the vault.** `nonReentrant` on this function stops a re-entrant `claim`
on its own, and the vault's guard would stop it again. Do it anyway: an heir can be a contract, ETH
goes out with `call`, and the ordering costs nothing. Checks-effects-interactions is the rule that
still holds when someone later removes a modifier they thought was redundant.

**Truncation leaves dust.** `payOut` computes `snapshot * bps / 10000` and rounds down, so a
three-way split of 1 wei leaves 1 wei in the vault forever. That is deliberate — the alternative is
the last heir being paid a rounding error more than the vault holds, which reverts. Say this out
loud in the video if anyone asks; do not "fix" it by paying the remainder to the last claimer,
which turns claim order into a payout difference.

**A zero share and a zero snapshot are different.** `bps == 0` means this heir was allocated
nothing of this asset, so skip it and leave the flag unset. A non-zero share of an asset whose
snapshot is zero (deposited, then fully withdrawn before unlock) pays 0 — `payOut` returns 0
without moving money. Decide which you want: as written above, the flag is set and the heir cannot
retry, which is correct because nothing will ever change that snapshot.

---

## 9. External views

```solidity
function hasClaimed(uint256 estateId, uint256 heirLabelhash, address token) external view returns (bool);

/// What one heir would receive of one asset right now: 0 if paid, if unallocated, or before unlock.
function claimableOf(uint256 estateId, uint256 heirLabelhash, address token) external view returns (uint256);

/// Every asset and every amount in one read, so the heir dashboard is one RPC call.
function claimableAll(uint256 estateId, uint256 heirLabelhash)
    external view returns (address[] memory tokens, uint256[] memory amounts);
```

`claimableOf` is `I_VAULT.snapshotOf(estateId, token) * shareOf(...) / 10000`, guarded by the paid
flag. Build the maths in an internal `_claimable` and have both views call it, so the number the
frontend shows and the number the vault pays can never drift.

---

## 10. Do it in this order

1. §1–§6 — imports through constructor. `forge build`.
2. `claim`, but with the loop body reduced to `s_paid` plus `I_VAULT.payOut`. This is the contract;
   everything else is a view.
3. The three guards (status, label, `canClaim`) and their errors.
4. `_claimable` and the three views.
5. `forge fmt`, `forge build --sizes`.

---

## 11. You are done when

- `forge fmt --check` and `forge build --sizes` are clean and every existing test still passes.
- An heir who holds the ENS role is paid their share of every asset in one transaction.
- The same heir calling again reverts `NothingToClaim` rather than being paid twice.
- An address that is not the heir, and the right heir before `unlockHeir` ran, both revert
  `NotEntitled` — and you have checked that the revert comes from the ENS read, not from the status
  check, because that read is the ENS track's claim in one line.
- Two heirs claiming in either order receive the same amounts, because both were measured against
  the same snapshot.

Say the word and I will write the spec-first test suite before you start step 2, the way I did for
the vault.
