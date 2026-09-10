# Checkpoint 9.4 — The reads the frontend needs

Small, and it has to happen before Checkpoint 9.5. Not in `documents/build-plan.md`, because the
plan assumed the frontend would be wired after deployment, and the ordering turns out to run the
other way.

**Status: done.** The four views below are in `src/HeritRegistry.sol`. This sheet records what was
added, why each one exists, and which screen consumes it.

---

## 1. Why a view function is deadline-sensitive

Adding a `view` normally costs nothing. Here it costs five deployments.

All five contracts hold each other as `immutable`, so a new `HeritRegistry` is a new address, and
the gate, vault, claim manager and attestor all carry that address in bytecode. Redeploying one
means redeploying the ring, plus re-running the two ENS root-role grants. There is no setter
anywhere in `src/` to soften that, deliberately.

So the rule for this checkpoint: **every read a screen needs must exist before `DeployHerit`
runs.** A missing getter found on demo day is not a small fix.

The audit was done by reading `frontend/` against the five contracts. Four reads the screens
depend on had no on-chain answer at all.

---

## 2. What was added

### `estateOf(uint256 estateId) → Estate`

The dashboard's main card shows `lastCheckIn`, the interval and the grace duration. All three live
in the `Estate` struct, `s_estates` is `private`, and nothing exposed it. One read now returns the
whole record.

**The one subtlety:** the returned `status` is `_pendingStatus`, not the stored field. The stored
one is a cache that only moves when someone calls `pokeExpiry`, so an estate whose grace lapsed an
hour ago still has `Status.Active` sitting in storage. Returning that would put a green "active"
pill on a screen belonging to an estate that is, in fact, unlocked. The view overwrites it with the
computed status, so `estateOf(id).status` and `statusOf(id)` can never disagree.

### `deadlinesOf(uint256 estateId) → (uint256 graceStartsAt, uint256 unlocksAt)`

The countdown ring needs the two moments the machine turns on, and the setup screen's "your heirs
can claim 37 days after your last selfie check" is the same arithmetic. `_pendingStatus` was
already computing both at every call and throwing them away.

Rather than duplicate the sum in a view — two copies of a deadline is a bug with a delay fuse —
the arithmetic moved into an internal `_deadlines`, and `_pendingStatus` now calls it. One place
computes when an estate unlocks. The state machine and the countdown on screen read the same
function, so a change to one is a change to both.

Both return zero before the estate is configured or has ever checked in. That is the same case
`_pendingStatus` reads as `Active`, and the frontend should render it as "not started" rather than
as a date in 1970.

`uint256`, not `uint64`, because that is the width the arithmetic is done in. Returning `uint64`
would mean a downcast, and a downcast in a view about deadlines is the kind of thing nobody checks
twice.

### `heirAddressOf(uint256 estateId, uint256 heirLabelhash) → address`

The heirs table shows an address per heir. `heirsOf` returns labelhashes and `heirLabelOf` returns
labels; the address was recorded in `s_heirAddress` and never exposed.

### `defaultShareOf(uint256 estateId, uint256 heirLabelhash) → uint16`

The UI shows one share per heir. `shareOf` demands a token, because a share can be overridden per
asset. There was a workaround — `shareOf(id, heir, address(0))` falls through to the default,
since nothing can override on the zero address — and it is exactly the sort of trick that reads as
a bug six weeks later. A named getter costs two lines.

### The two constants, already public

`MIN_CHECK_IN_INTERVAL`, `MAX_CHECK_IN_INTERVAL`, `MIN_GRACE_DURATION` and `MAX_GRACE_DURATION`
were `private`, and were widened to `public` when they were aligned to the setup screen's presets
(2 minutes–90 days, 1 minute–14 days). The form can read its own bounds instead of keeping a
second copy that drifts.

---

## 3. The map, screen by screen

`frontend/lib/fixtures/estate.ts` is the design fixture every screen reads. Wiring it up is a
per-field swap, so here is each field against its call.

| Fixture field | Call |
|---|---|
| `status` | `HeritRegistry.statusOf` |
| `lastCheckIn`, `checkInInterval`, `graceDuration` | `HeritRegistry.estateOf` |
| `windowCloses`, `unlocksAt`, `remaining`, `progress` | `HeritRegistry.deadlinesOf`, formatted client-side |
| `estateRegistry` | `AccessControlGate.estateRegistryOf` |
| `heirs[].label` | `HeritRegistry.heirsOf` → `heirLabelOf` |
| `heirs[].address` | `HeritRegistry.heirAddressOf` |
| `heirs[].shareBps` | `HeritRegistry.defaultShareOf` |
| `heirs[].relationship` | resolver `text(node, "herit.relationship")` |
| `vaultEth` | `HeritVault.tokensOf` + `balanceOf` |
| claim amounts | `ClaimManager.claimableAll` |
| "may this heir claim?" | `AccessControlGate.canClaim` |

`remaining` and `progress` are derived from `deadlinesOf` and the current block time. Do that in
the browser, not on-chain — a contract that formats "11d 04h" is a contract paying gas to be a
date library.

---

## 4. What is still not a contract read, on purpose

**`heirs[].claimed`** is a single boolean in the fixture. On-chain it is per heir *per token*
(`ClaimManager.hasClaimed`), because an heir can take their ETH today and their USDC next week.
Derive the boolean from `claimableAll` returning all zeros; do not add a contract function for it.

**The activity log** is the event stream — `EstateOpened`, `CheckedIn`, `EnteredGrace`, `Claimed`
and the rest. Read it with `getLogs`, or with the Ponder indexer in ARCHITECTURE.md §6.4 if there
is time. Events are already indexed by `estateId`, which is the only thing a contract can usefully
do here. Storing a log on-chain for a UI to read would be paying storage rent for a scrollback
buffer.

**Estate discovery.** Nothing maps a wallet to its estate, and nothing should for a hackathon: the
frontend asks for the label, hashes it, and checks
`registryA.getOwner(keccak256(label)) == connectedAddress`. An on-chain reverse index would be a
second copy of ENS.

---

## 5. Verified at the stop

- `forge build --sizes` passes. `HeritRegistry` is 12,637 bytes, 11,939 under the limit — the four
  views cost about 1KB and nothing is close to tight.
- `estateOf(id).status == statusOf(id)` for an estate whose grace has lapsed but which nobody has
  poked. This is the check that proves the cache is not leaking into the UI.
- `deadlinesOf` returns `(0, 0)` for an estate that has never checked in, and
  `lastCheckIn + interval` for one that has.

---

## 6. Next

Checkpoint 9.5 — `script/DeployHerit.s.sol`. The contracts are now read-complete, so what that
script deploys is what the frontend can actually talk to.
