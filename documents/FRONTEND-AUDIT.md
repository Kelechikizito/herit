# Frontend audit — every interaction against the contract surface

Walked every button, form and rendered value in `frontend/app` and `frontend/components`, and
checked each against the five contracts in `src/`. The question in each case: **can this actually
be wired, or is it drawing something the chain cannot answer?**

Run before Checkpoint 9.5, deliberately. Every dependency between the five contracts is
`immutable` with no setter, so a missing function found after deployment is not a small fix — it
is a redeploy of all five plus the two ENS root-role grants. Anything below marked ❌ has to be
decided now or accepted permanently.

---

## Reads and writes, screen by screen

| Interaction | Contract call | Status |
|---|---|---|
| **"which estates do I own?"** | `gate.estatesOfGrantor(address)` | ✅ added |
| **"where am I an heir?"** | `registry.heirSlotsOf(address)` | ✅ added |
| setup → open estate | `gate.openEstate` | ✅ |
| setup → register heir | `gate.registerHeir` | ✅ |
| setup → timers | `registry.configure` | ✅ |
| setup → fund | `vault.depositETH` / `depositERC20` | ✅ |
| setup → label available? | `registry.isAvailable` | ✅ |
| setup → estate registry address, before paying | `gate.predictEstateRegistry` | ✅ |
| dashboard → check in now | `attestor.checkIn` | ✅ |
| dashboard → status pill | `registry.statusOf` | ✅ |
| dashboard → countdown ring, window/unlock dates | `registry.estateOf`, `registry.deadlinesOf` | ✅ added in 9.4 |
| dashboard → estate registry address | `gate.estateRegistryOf` | ✅ |
| dashboard → heir list | `heirsOf`, `heirLabelOf`, `heirAddressOf`, `defaultShareOf` | ✅ heirAddressOf / defaultShareOf added in 9.4 |
| dashboard → vault total and split | `vault.tokensOf`, `vault.balanceOf` | ✅ |
| dashboard → vault deposit | `vault.depositETH` / `depositERC20` | ✅ |
| heirs → register heir | `gate.registerHeir` | ✅ |
| heirs → heir records (`addr(60)`, relationship, share) | `heirAddressOf`, `defaultShareOf`, resolver `text()` | ✅ |
| heirs → allocation total | sum `defaultShareOf` client-side | ✅ no getter for `s_allocatedDefaultBps`, and none needed |
| claim → eligibility | `gate.canClaim` | ✅ |
| claim → your share | `claimManager.claimableOf` / `claimableAll` | ✅ |
| claim → selfie check and claim | `attestor.claim` | ✅ |
| wallet → connect / switch network | none — wagmi | n/a |
| **heirs → the trash icon on every heir row** | **nothing exists** | ❌ |
| dashboard → activity log | events only | ⚠️ needs `getLogs` or an indexer |

---

## The one dead control

`components/heirs/heir-table.tsx:44` renders a trash button on every heir row,
`aria-label="release the {label} heir slot"`.

There is no contract function behind it. `grep -rniE "function (remove|revoke|delete|unregister)"`
over `src/` returns **zero matches** — not in `HeritRegistry`, not in `AccessControlGate`. Heirs
are append-only.

Building one is not a small addition. It would have to revoke the ENS subname's role in registry
B, decide what happens to the `herit.share` record already written to the resolver, and unwind
`s_allocatedDefaultBps` so the freed basis points can be re-allocated. Three places to get wrong,
in the contract that unlock walks.

**Recommendation: delete the button.** An inheritance product where the heir list only grows is
defensible and easy to explain. A trash icon wired to nothing is not, and a judge will click it.

---

## Functions with no UI

The reverse gap. These exist, work, and nothing on screen reaches them.

| Function | Why it matters |
|---|---|
| `registry.pokeExpiry` | Permissionless, and the transition two screens describe in prose ("anyone may poke the registry"). It is the best live moment in the demo and there is no button for it. |
| `vault.withdraw` | The grantor taking assets back out before unlock. A real trust story — the vault is opt-in escrow, not a one-way door — and currently invisible. |
| `registry.setShare` | Per-token share overrides. The UI models one share per heir; this is fine to leave unexposed for the hackathon. |

---

## Shape mismatches, not missing functions

Things the UI models more simply than the chain does. All fixable in the frontend alone.

- **`estate.vaultEth` is a single number.** The vault holds a token list, and every heir's share
  is per token. `tokensOf` + `balanceOf` returns the real picture.
- **`heir.claimed` is one boolean.** On-chain it is per heir *per token* (`hasClaimed`), because
  an heir can take their ETH today and their USDC next week. Derive it from `claimableAll`
  returning all zeros — do not add a contract function for it.
- **The setup wizard never collects an expiry**, but `gate.openEstate(label, grantor, expiry)`
  requires one, and `registerHeir` caps every heir subname against it. Pick a default in code
  (a year) rather than discovering it on demo day.
- **`heir.relationship`** comes from the resolver's `herit.relationship` text record, not from any
  Herit contract. Needs the `UpgradableUniversalResolverProxy` override at
  `0xd26f2040d083af1cd2962ba303f4bea0c4faf142`, which `lib/wagmi/chains.ts` already sets.

---

## The two reverse lookups, and one caveat

Both were missing entirely — every other getter is keyed by `estateId`, so a connected wallet had
no way to find its own estates without being told the label first.

```solidity
// AccessControlGate — written in openEstate
function estatesOfGrantor(address grantor) external view returns (uint256[] memory);

// HeritRegistry — written in recordHeir
struct HeirSlot { uint256 estateId; uint256 heirLabelhash; }
function heirSlotsOf(address heir) external view returns (HeirSlot[] memory);
```

The heir side returns both halves because an heir needs `heirLabelhash` as well as `estateId` to
call `claimableAll` or `claim`.

**`estatesOfGrantor` is a hint, not the truth.** The grantor name is an ENS name and ENS names
transfer. After a transfer the index still lists the estate under whoever opened it, and the new
owner appears nowhere. Confirm every entry with `I_GRANTOR_REGISTRY.getOwner(estateId)` before
showing it as theirs.

`heirSlotsOf` has no such problem — `s_heirAddress` is set once at `recordHeir` and nothing
reassigns it. It is unbounded in principle, so page it off-chain and never read it inside a
transaction.

Covered by `testWalletCanFindItsOwnEstates` in `test/integration/HeritLifecycleTest.t.sol`,
against the real ENS registry on a Sepolia fork.
