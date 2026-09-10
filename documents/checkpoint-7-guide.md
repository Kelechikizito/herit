# Checkpoint 7 — HeritRegistry

A build sheet for `src/HeritRegistry.sol`, top to bottom in the order the file is laid out.
Signatures and rules only; the bodies are yours.

Two contracts are already waiting on this one: `AccessControlGate.unlockHeir` and
`HeritVault.snapshot` are both `onlyHeritRegistry`, and the vault reads `statusOf` on every
deposit and withdrawal. The deployed gate points at your EOA — Checkpoint 8 redeploys it
against this contract and re-runs the two grants. Registry A, the resolver and `herit.eth`
survive untouched.

---

## 1. Imports

```solidity
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritVault} from "src/HeritVault.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
```

Declare it `contract HeritRegistry is IHeritRegistry`. No import cycle: the gate and the vault
import the *interface*, not this contract.

Delete the stub's `IRegistry` and `RegistryRolesLib` imports and its `isAvailable` — Checkpoint
1 residue that nothing calls. Take `isAvailable` out of `IHeritRegistry` at the same time.

---

## 2. Errors

```solidity
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
```

---

## 3. Type declarations

`Status` already exists in `IHeritRegistry` — do not redeclare it.

```solidity
struct Estate {
    uint64 lastCheckIn;
    uint64 checkInInterval;
    uint64 graceDuration;
    Status status;
}
```

25 bytes, so one storage slot. Keep it that way: every `pokeExpiry` reads all four.

---

## 4. State variables

```solidity
uint16  private constant BPS_DENOMINATOR = 10_000;
uint256 public  constant MAX_HEIRS = 10;              // the unlock loop is ENS role grants

IPermissionedRegistry public immutable I_GRANTOR_REGISTRY;  // registry A — who the grantor is
AccessControlGate     public immutable I_GATE;
HeritVault            public immutable I_VAULT;
address               public immutable I_ATTESTOR;          // CREATE2-predicted, Checkpoint 9

mapping(uint256 estateId => Estate estate) private s_estates;

mapping(uint256 estateId => uint256[] heirLabelhashes) private s_heirs;
mapping(uint256 estateId => mapping(uint256 heirLabelhash => address heir)) private s_heirAddress;

mapping(uint256 estateId => mapping(uint256 heirLabelhash => uint16 bps)) private s_defaultShare;
mapping(uint256 estateId => uint16 bps) private s_allocatedDefaultBps;

mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => uint16 bps)))
    private s_share;
mapping(uint256 estateId => mapping(uint256 heirLabelhash => mapping(address token => bool)))
    private s_hasOverride;
```

An heir's share of a token is their override if one is set, otherwise their default. Per-token
totals are computed on demand by looping the heir list (capped at 10) — cheaper to reason about
than a running total per token, which a default change would have to fix up everywhere.

---

## 5. Events

```solidity
event EstateConfigured(uint256 indexed estateId, uint64 checkInInterval, uint64 graceDuration);
event HeirRecorded(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed heir, uint16 defaultShareBps);
event ShareSet(uint256 indexed estateId, uint256 indexed heirLabelhash, address indexed token, uint16 bps);
event CheckedIn(uint256 indexed estateId, uint64 at);
event EnteredGrace(uint256 indexed estateId, uint64 at);
event Unlocked(uint256 indexed estateId, uint64 at, uint256 heirCount);
```

These are the demo. The countdown and the "it just unlocked" moment both come from them.

---

## 6. Modifiers

```solidity
modifier onlyGrantorOf(uint256 estateId) { _onlyGrantorOf(estateId); _; }
modifier onlyGate()                      { _onlyGate();              _; }
modifier onlyAttestor()                  { _onlyAttestor();          _; }
modifier notUnlocked(uint256 estateId)   { _notUnlocked(estateId);   _; }
```

Same wrapped shape as `HeritVault`, for the same lint reason.

---

## 7. Constructor

```solidity
constructor(
    IPermissionedRegistry grantorRegistry,
    AccessControlGate gate,
    HeritVault vault,
    address attestor
)
```

Revert `HeritRegistry__ZeroAddress` if any is zero, then assign. All four `immutable`.

`gate` and `vault` exist by the time this is deployed; `attestor` does not, so it is
CREATE2-predicted the way the vault's `I_CLAIM_MANAGER` is. This contract's own address is
predicted too, because the gate and the vault take it in *their* constructors —
`script/DeployHerit.s.sol` asserts every prediction before it broadcasts.

---

## 8. External functions

### `configure(uint256 estateId, uint64 checkInInterval, uint64 graceDuration)`
`onlyGrantorOf`, `notUnlocked`. Starts or restarts the clock.

1. Revert `InvalidTimers` if either duration is zero.
2. Write both durations, set `lastCheckIn = block.timestamp`, set `status = Active`.
3. Emit `EstateConfigured`.

No minimum interval — the demo runs on minutes.

### `checkIn(uint256 estateId)`
`onlyAttestor`. The World ID liveness proof has already been verified by the time this is
called; this contract only moves the clock.

1. Revert `NotConfigured` if `lastCheckIn == 0`.
2. Revert `EstateUnlocked` if `_pendingStatus(estateId) == Unlocked` — check the *pending*
   status, not the stored one. Otherwise a grantor whose grace lapsed a week ago, in an estate
   nobody has poked, could check in and erase the heirs' pending claim.
3. Set `lastCheckIn = block.timestamp`, set `status = Active`.
4. Emit `CheckedIn`.

### `pokeExpiry(uint256 estateId)`
Open to any caller. Moves the estate to wherever the clock says it should be.

1. `Status pending = _pendingStatus(estateId);`
2. If `pending == stored`, return. **A no-op, not a revert** — two callers can poke in the same
   block, and neither should fail.
3. If `pending == Grace`, store it and emit `EnteredGrace`.
4. If `pending == Unlocked`, call `_unlock(estateId)`.

Because step 1 computes rather than steps, an estate where both windows lapsed goes straight to
`Unlocked` on the first poke. That is the case that breaks a hand-written `Active → Grace →
Unlocked` ladder.

### `recordHeir(uint256 estateId, uint256 heirLabelhash, address heir, uint16 defaultShareBps)`
`onlyGate`. Called from the end of `AccessControlGate.registerHeir`, so an heir's ENS records
and their share are written in the same transaction or neither is.

1. Revert `TooManyHeirs` if the list is already `MAX_HEIRS` long.
2. Revert `ShareOverflow` if `s_allocatedDefaultBps + defaultShareBps > BPS_DENOMINATOR`.
3. Push the labelhash, store `heir` and the default, add to the running default total.
4. Emit `HeirRecorded`.

### `setShare(uint256 estateId, uint256 heirLabelhash, address token, uint16 bps)`
`onlyGrantorOf`, `notUnlocked`. The per-asset override.

1. Revert `HeirNotFound` if `s_heirAddress[estateId][heirLabelhash] == address(0)`.
2. Write the override and its flag.
3. Revert `ShareOverflow` if `_totalBps(estateId, token) > BPS_DENOMINATOR` **after** the write.
4. `I_GATE.writeShareRecord(estateId, heirLabelhash, token, bps)` — a new `onlyHeritRegistry`
   function on the gate, writing the text record `herit.share.<token>`. Skip it if time is
   short; the matrix is still correct, only less legible on chain.
5. Emit `ShareSet`.

---

## 9. Internal functions

### `_unlock(uint256 estateId)`
The only place this contract reaches out, and the order matters:

```
1. s_estates[estateId].status = Unlocked;      first, so any re-entry sees the truth
2. if the grantor name has lapsed, renew it;   see the trap below
3. I_VAULT.snapshot(estateId);                 freeze the balances
4. for each heir: I_GATE.unlockHeir(estateId, heirLabelhash, s_heirAddress[...]);
5. emit Unlocked(estateId, block.timestamp, heirs.length);
```

**Step 2 is the trap.** `unlockHeir` reverts with `AccessControlGate__EstateExpired` if the
grantor name has lapsed, which would make `pokeExpiry` revert for everybody, permanently, at
the moment the grantor is no longer around to fix it. `renewEstate` is permissionless for
exactly this reason — but it must be conditional, because `PermissionedRegistry.renew` reverts
`CannotReduceExpiry` when the name is still healthy:

```solidity
if (I_GRANTOR_REGISTRY.getExpiry(estateId) <= block.timestamp) {
    I_GATE.renewEstate(estateId, uint64(block.timestamp) + 365 days);
}
```

Stay well under the gate's `MAX_RENEWAL_WINDOW` of 3650 days or `renewEstate` reverts
`ExpiryTooFar`.

**Change `unlockHeir` to take the labelhash instead of the string.** Its body only ever calls
`_labelhash(label)` on it, so the hash is all it needs — and then this contract never stores
heir label strings. The resolver writes in `registerHeir` still need the string; nothing else
does.

### `_pendingStatus(uint256 estateId) internal view returns (Status)`
The whole clock, in one function:

```
if (stored == Unlocked)                return Unlocked;   // terminal
uint64 graceStartsAt = lastCheckIn + checkInInterval;
uint64 unlocksAt     = graceStartsAt + graceDuration;
if (block.timestamp >= unlocksAt)      return Unlocked;
if (block.timestamp >= graceStartsAt)  return Grace;
return Active;
```

Get this right and all four poke cases are right.

### The rest

```solidity
function _effectiveShare(uint256 estateId, uint256 heirLabelhash, address token) internal view returns (uint16);
function _totalBps(uint256 estateId, address token) internal view returns (uint256);   // loops s_heirs
function _onlyGrantorOf(uint256 estateId) internal view;   // I_GRANTOR_REGISTRY.getOwner, zero → EstateNotFound
function _onlyGate() internal view;
function _onlyAttestor() internal view;
function _notUnlocked(uint256 estateId) internal view;
```

`_onlyGrantorOf` is the same three lines as `HeritVault._onlyGrantorOf`, for the same reason:
the grantor is whoever owns the estate's name in registry A, so there is no second copy to keep
in step.

---

## 10. External views

```solidity
function statusOf(uint256 estateId) external view returns (Status);           // the STORED status
function pendingStatusOf(uint256 estateId) external view returns (Status);    // what the clock says
function deadlinesOf(uint256 estateId) external view returns (uint64 graceStartsAt, uint64 unlocksAt);
function estateOf(uint256 estateId) external view returns (Estate memory);
function heirsOf(uint256 estateId) external view returns (uint256[] memory);
function shareOf(uint256 estateId, uint256 heirLabelhash, address token) external view returns (uint16);
function unallocatedBps(uint256 estateId, address token) external view returns (uint256);
```

`statusOf` returns the **stored** status, because unlocking has side effects a view cannot
perform — ENS role grants and the vault snapshot. An estate whose grace lapsed but which nobody
has poked really is still `Grace`: no heir has rights, because nothing has granted them. The
consequence is that a late-but-unpoked grantor can still withdraw from the vault, which is
correct — nothing has been taken from anyone yet.

`pendingStatusOf` and `deadlinesOf` are what the frontend counts down with.

---

## 11. The totals rule, and a correction

I said earlier that unlock should require every asset's shares to total exactly 10000. **That
was wrong.** Such a check makes `pokeExpiry` revertible, and `pokeExpiry` is the one transition
that must never be blockable — an estate at 9000 would become an estate nobody can ever
inherit. So:

- **Over-allocation is impossible**, refused at write time by `recordHeir` and `setShare`, when
  the grantor is still around to fix it.
- **Under-allocation is allowed**, and surfaced through `unallocatedBps` so the frontend can say
  "you have allocated 90% of your USDC". The remainder stays in the vault.

---

## 12. Do it in this order

1. §1–§7 — imports through constructor. `forge build`.
2. `configure`, `_pendingStatus`, `statusOf`, `pendingStatusOf`, `deadlinesOf`. Pure clock
   arithmetic, and where the four poke cases either work or do not.
3. `checkIn` and `pokeExpiry`, with `_unlock` left as a stub. Just the state moves.
4. `_unlock`: the vault snapshot and the `unlockHeir` loop.
5. `recordHeir`, `setShare`, `_effectiveShare`, `_totalBps`, and the views.
6. `forge fmt`, `forge build --sizes`.

Steps 2 and 3 are the contract. Everything else is plumbing onto contracts that already work.

---

## 13. You are done when

- `forge fmt --check` and `forge build --sizes` are clean, and all 30 existing tests still pass.
- Poked inside the interval, poked twice in a block, and poked once after both windows lapsed:
  all correct, none of them reverting.
- `checkIn` pulls `Grace` back to `Active` and reverts once the clock says `Unlocked`.
- Unlocking sets the status, snapshots the vault, and grants every heir their ENS role, in one
  transaction.
- No share write can push an asset past 100%, and no share state can prevent an unlock.

Say the word and I will write the spec-first test suite before you start step 2, the way I did
for the vault.
