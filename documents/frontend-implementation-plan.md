# Herit frontend — implementation plan

Written for another agent/session to pick up and execute. Revised 2026-09-10 against the
deployed Checkpoint 9.5 contracts and the Checkpoint 10 backend already on the branch.

Read alongside: [ARCHITECTURE.md](../ARCHITECTURE.md), [deployments.md](deployments.md) (addresses,
the 9.5 deployment), [FRONTEND-AUDIT.md](FRONTEND-AUDIT.md) (every screen checked against the
contract surface), [checkpoint-10-guide.md](checkpoint-10-guide.md) (the World ID backend), and
`frontend/AGENTS.md` — Next.js here is 16.3.4; read `frontend/node_modules/next/dist/docs/`
before writing routing or data-fetching code.

---

## Context

**What exists.**

- The five contracts are deployed on Sepolia and verified on Etherscan (`deployments.md`,
  Checkpoint 9.5). `frontend/lib/contracts/addresses.ts` hardcodes them as one set, on purpose.
  The generated ABIs (`lib/contracts/abis/*.abi.ts`) were checked on 2026-09-10: every function in
  them exists in the deployed bytecode.
- The Checkpoint 10 backend is built: `app/api/worldid/sign`, `app/api/worldid/verify`,
  `lib/server/nullifier-ledger.ts`. The Selfie Check modal runs the real IDKit flow and hands a
  `SignedAttestation` to its `onVerified` callback.
- The UI is fully designed (Next.js 16, React 19, wagmi 3, viem 2, Tailwind 4).

**What does not.**

- **Nothing sends a transaction.** There is no `useWriteContract` anywhere, and none of the three
  `SelfieCheckModal` call sites (`setup-wizard.tsx`, `proof-of-life-card.tsx`, `claim-card.tsx`)
  passes `onVerified`, so a passed Selfie Check goes nowhere.
- **Four app screens render fixtures**: `app/(app)/dashboard/page.tsx`, `app/(app)/heirs/page.tsx`,
  `components/claim/claim-view.tsx`, `components/setup/steps/heirs-step.tsx`. The only live read is
  `useEstateStatus` in `lib/estate/use-estate.ts`.

**What changed since the first version of this plan.** It proposed a subgraph for estate
discovery and a hand-rolled resolver helper. Neither is needed any more:

- Discovery is on-chain: `AccessControlGate.estatesOfGrantor(address)` and
  `HeritRegistry.heirSlotsOf(address)`.
- The estate **label** for an id comes from ENSv2's `LabelStore.getLabel(uint256)` at
  `0xd7351f76866123a7e49381f38a30a96adba7e855` (the gate keeps its own label mapping private).
  Verified: `getLabel(labelhash("alice"))` returns `"alice"`.
- Heir records read through viem/wagmi's standard ENS actions, because `lib/wagmi/chains.ts`
  already overrides the Universal Resolver. Verified on `son.alice.herit.eth`: `getEnsAddress`
  returns the heir address, `getEnsText` returns `"son"` for `herit.relationship` and `"6000"` for
  `herit.share`.

The Graph survives only as the implementation of the activity feed (Phase F), the one screen that
needs event history.

---

## Facts the implementation depends on

All read from `src/` or checked on Sepolia. Each one is a bug if ignored.

| Fact | Consequence |
|---|---|
| `canClaim` checks ENS roles only. The claim role is granted during the unlock transition, which runs on `pokeExpiry` — or inside `ClaimManager.claim`, which pokes first. | `canClaim` reads `false` for a lapsed estate nobody has poked. **Never gate the claim button on it.** Gate on `statusOf == Unlocked` and `heirAddressOf(estateId, heirLabelhash) == connected address`. Show `canClaim` as the ENS role chip — it is the demo's false→true moment. |
| `checkIn` reverts `NotConfigured` until `configure` has run. | Setup order is `openEstate` → `configure` → `registerHeir`×N → deposit → Selfie Check → `attestor.checkIn`. |
| `openEstate(label, grantor, expiry)` needs an expiry; `registerHeir` caps each heir's expiry at the estate's. | Default estate expiry to now + 365 days. Heirs take the estate's expiry, read from registry A's `getExpiry(estateId)`. |
| `registerHeir` writes the ENS records and calls `HeritRegistry.recordHeir` itself. | One transaction per heir. The frontend never calls `recordHeir`. |
| `estatesOfGrantor` is a hint: ENS names transfer, the index does not follow. | Confirm each id with registry A's `getOwner(estateId)` before showing it as the viewer's. |
| `claimableAll` / `claimableOf` read the vault **snapshot**, which is zero until the unlock transition runs. | Before a poke, show `balanceOf × shareOf / 10000` labelled as an estimate. |
| Timer bounds: interval 2 min – 90 days, grace 1 min – 14 days (`MIN_*`/`MAX_*` constants). | Validate the presets against the constants read from chain, not copies. |
| The attestation expires 5 minutes after signing (`ATTESTATION_TTL_SECONDS`). Its uint256 fields arrive as decimal strings. | Send the transaction from `onVerified` immediately, not on a second click. Convert with `BigInt(...)`. |
| Heirs are append-only; no removal function exists. | Delete the trash button in `heir-table.tsx` (audit recommendation). |
| ERC20 deposits pull with `transferFrom`; native ETH is `address(0)` in the vault (`NATIVE_TOKEN`). | `approve` before `depositERC20`. |
| Deployment block: **11675256**. | `fromBlock` for any event scan, `startBlock` for a subgraph. |

---

## Prerequisites

1. **A working Sepolia RPC** in `frontend/.env.local` as `NEXT_PUBLIC_SEPOLIA_RPC_URL`. The Alchemy
   key in the repo-root `.env` returned `401 Must be authenticated!` on 2026-09-10 — replace it
   too, or `make check-herit` and every `--rpc-url sepolia_eth` command fail.
2. **World ID Portal**: the Selfie Check flag is enabled, and the per-estate action
   `herit:<label>` exists in the target environment (checkpoint-10-guide §3 — create on the fly,
   or pre-register the demo estate).
3. Two or three test wallets with Sepolia ETH, and MockUSDC for the ERC20 path (nothing mints it
   during the demo).

---

## Phase 0 — Fix two defects in the built backend

Do this before any claim UI exists, or the first failed claim locks its heir out.

**0.1 The ledger records before the transaction exists.** `verify/route.ts` calls
`recordClaim`/`recordCheckIn` *before* signing, and nothing ever removes an entry. Any claim that
does not land — estate not unlocked yet, wallet prompt dismissed, attestation expired — leaves the
heir permanently refused with "this human has already claimed from this estate", while the
contract would accept them. The check-in side has a milder version: whichever human verifies
first binds the estate in the file, even if their transaction is never sent.

Fix: replace the file ledger with **read-only pre-checks against the chain**, run after the
commitment is computed and before signing. Each mirrors a revert the transaction would hit:

| Purpose | Check | Mirrors |
|---|---|---|
| check-in | registry A `getOwner(estateId) == subject` | `LivenessAttestor__NotTheGrantor` |
| check-in | `attestor.commitmentOf(estateId)` is zero or equals `commitment` | `LivenessAttestor__WrongHuman` |
| check-in | `registry.estateOf(estateId).checkInInterval != 0` | `HeritRegistry__NotConfigured` |
| check-in | `registry.statusOf(estateId) != Unlocked` | `HeritRegistry__EstateUnlocked` |
| claim | `registry.statusOf(estateId) == Unlocked` | `ClaimManager__EstateNotUnlocked` |
| claim | `registry.heirAddressOf(estateId, heirLabelhash) == subject` | `ClaimManager__NotEntitled` |
| claim | `!attestor.claimCommitmentUsed(estateId, commitment)` | `LivenessAttestor__CommitmentUsed` |
| claim | `attestor.commitmentOf(estateId) != commitment` | `LivenessAttestor__WrongHuman` (grantor claiming) |

Batch them in one `multicall` from a viem public client in the route. Then delete
`lib/server/nullifier-ledger.ts` and its `.gitignore` entry. The chain is already the ledger, and a
file under `.data/` does not survive a serverless deploy anyway. Update checkpoint-10-guide §9 to
say so.

**0.2 One attestor address, not two.** The route reads `NEXT_PUBLIC_ATTESTOR_ADDRESS` from the
environment while the client uses `herit.livenessAttestor` from `addresses.ts`. If they drift, the
signature recovers to the wrong signer and every check-in reverts. Import `herit.livenessAttestor`
in the route, remove the key from `.env.example`, and drop the cross-reference in the
`addresses.ts` comment.

**0.3** Delete the stale "there is no on-chain getter for lastCheckIn…" comment in
`lib/estate/use-estate.ts`. `estateOf` and `deadlinesOf` exist.

---

## Phase A — Contract access layer

**A1. ENS addresses and handwritten ABIs.** Add `labelStore` to the `ens` object in
`addresses.ts`. New `lib/contracts/abis/ens.ts` — handwritten, so no `.abi.ts` suffix, per the
convention from `475ae3e` — with `parseAbi` fragments for `LabelStore.getLabel(uint256)` and
registry A's `getOwner(uint256)` / `getExpiry(uint256)`. Use viem's built-in `erc20Abi` for tokens.

**A2. Address + ABI pairs.** New `lib/contracts/contracts.ts` exporting
`{ heritRegistry: { address, abi }, … }` so every hook spreads `...contracts.heritRegistry` and an
address can never be paired with the wrong ABI.

**A3. Ids and labels.** New `lib/estate/ids.ts`: `estateIdOf(label)` and `heirLabelhashOf(label)` as
`BigInt(keccak256(toBytes(label)))`, plus the label pattern. Move `LABEL_PATTERN` out of
`verify/route.ts` into this module and import it in both places, so client validation and server
validation cannot disagree.

**A4. Revert decoding.** New `lib/contracts/errors.ts`: walk a viem `BaseError` to
`ContractFunctionRevertedError`, read `data.errorName`, and map every `HeritRegistry__*`,
`AccessControlGate__*`, `HeritVault__*`, `ClaimManager__*` and `LivenessAttestor__*` error to a
sentence the user can act on. Unknown errors fall back to the revert's short message.

---

## Phase B — Discovery, on-chain

**B1. `useMyEstates(address)`** in `lib/estate/`: `estatesOfGrantor` → one `useReadContracts`
multicall for registry A `getOwner` per id → keep ids whose owner is `address` → a second multicall
for `LabelStore.getLabel` per id. Returns `{ estateId, label }[]`.

**B2. `useMyHeirSlots(address)`**: `heirSlotsOf` → multicall `heirLabelOf(estateId, heirLabelhash)`
and `LabelStore.getLabel(estateId)` per slot. Returns
`{ estateId, estateLabel, heirLabelhash, heirLabel }[]`.

**B3. Selection.** Dashboard and heirs pages take an optional `?estate=<label>`; the claim page
takes `?estate=<label>&heir=<label>`. Without params, use the first discovered estate or slot, with
a switcher when there are several. A URL param only selects among discovered entries — it grants
nothing, and a param that matches none shows "this wallet has no estate named …". No estate →
call to action linking to `/setup`. Check the Next 16 docs for `searchParams` / `useSearchParams`
(and any Suspense requirement) before writing this.

---

## Phase C — Read layer: replace every fixture

wagmi hooks are client-only, so each page stays a server component that computes `nowSeconds()`
for `useNow(initialNow)` and renders one client container that owns the hooks. Poll at the existing
`POLL_MS` (12 s).

**C1. Reshape `lib/estate/types.ts` to what the chain returns** (audit, "shape mismatches"):

- `vaultEth: number` becomes a token list (`{ token, symbol, decimals, balance, snapshot }`).
- `Heir.claimed: boolean` becomes per token, derived from `hasClaimed`.
- `EstateClock.storedStatus` goes away — the contract only exposes the pending status.
  "Has anyone poked yet?" is answered by `canClaim` on any heir.

`lib/estate/format.ts` keeps its pure clock helpers. `shareOfVault` becomes per token.

**C2. Hooks** (all in `lib/estate/`):

- `useEstate(estateId)` — `estateOf`, `deadlinesOf`, `gate.estateRegistryOf`.
- `useHeirs(estateId, estateLabel)` — `heirsOf` → multicall `heirLabelOf`, `heirAddressOf`,
  `defaultShareOf`, `gate.canClaim`. Add wagmi `useEnsText` (`herit.relationship`, `chainId:
  sepolia.id`) per `<heir>.<estate>.herit.eth`. Allocation is the client-side sum of
  `defaultShareOf`; there is no getter and none is needed.
- `useVault(estateId)` — `tokensOf` → multicall `balanceOf`, `snapshotOf`; `snapshotTaken`; ERC20
  `symbol`/`decimals` for non-native tokens.
- `useClaim(estateId, heirLabelhash)` — `claimableAll`, `hasClaimed` per token, `shareOf` per
  token for the pre-poke estimate.

**C3. Swap the fixtures out** of the four files listed in Context. `lib/fixtures/estate.ts` stays for
`components/landing/estate-preview-card.tsx`, which is marketing. Every card gets a loading, empty
and error state; none falls back to fixture data.

---

## Phase D — Write layer

**D1. One transaction hook.** New `lib/wagmi/use-transaction.ts` composing `useSimulateContract`
→ `useWriteContract` → `useWaitForTransactionReceipt`. It exposes
`idle | simulating | awaiting-signature | confirming | success | error`, blocks when `useWallet`
reports not connected or `isWrongNetwork`, turns reverts into sentences via A4, and invalidates
the affected queries on confirmation. Simulation is what catches most reverts before the wallet
prompt — every button uses it.

**D2. Selfie Check → transaction.** New `useAttestedAction(purpose)`: pass `onVerified` to the
modal. It converts the attestation's decimal strings to `BigInt` and immediately writes
`livenessAttestor.checkIn(attestation, signature)` or `.claim(attestation, signature)` through D1.
Add a sixth stage to the modal ("submitting to Sepolia" → confirmed), fed by an optional
`submission` prop, so the modal stays open through the wallet prompt and confirmation instead of
closing on "ready to submit".

**D3. Setup wizard** (`components/setup/setup-wizard.tsx` and the four steps).

State: lift everything into the wizard with a reducer — label, interval, grace, draft heirs, deposit
token and amount. Today every step renders `SETUP_DEFAULTS` and discards input.

Validation:

- label: A3's pattern, plus `isAvailable` (debounced). Show `predictEstateRegistry` so the grantor
  sees the address before paying.
- timers: presets converted to seconds, checked against the chain's `MIN_*`/`MAX_*`.
- heirs: unique labels, valid non-zero addresses, shares summing to ≤ 10000, count ≤ `MAX_HEIRS`.

Execution: replace the final button with a checklist that runs `openEstate` → `configure` →
`registerHeir` per heir → `approve` if ERC20 → deposit → Selfie Check via D2. **Make it resumable by
deriving each step's completion from chain**, not from local state:

- open: the id is in `estatesOfGrantor`
- configured: `estateOf.checkInInterval != 0`
- each heir: its labelhash is in `heirsOf`
- funded: `balanceOf > 0`
- checked in: `lastCheckIn != 0`

A reload mid-setup then continues, rather than resending `openEstate` and reverting
`EstateAlreadyOpen`.

**D4. Heirs page.** `AddHeirForm` → `registerHeir`, with expiry from registry A `getExpiry`,
disabled once the estate is unlocked. Delete `ReleaseButton` in `heir-table.tsx`. `setShare`
(per-token overrides) stays unexposed.

**D5. Dashboard.**

- `ProofOfLifeCard` → D2 check-in.
- `VaultCard` → deposit ETH, deposit ERC20 (`approve` then `depositERC20`), and `withdraw`. The
  audit calls withdraw "a real trust story" with no UI today.
- An "unlock now" button calling `pokeExpiry` directly, shown once `now ≥ graceStartsAt` from
  `deadlinesOf`. It is permissionless and a no-op when nothing changed.

**D6. Claim page.**

- `ClaimCard` → D2 claim.
- Enable when `statusOf == Unlocked`, `heirAddressOf == address`, and not every token is claimed.
- Replace the hardcoded `Requirement` rows with those three reads.
- Show `canClaim` beside them, and refresh it after the claim confirms — the transaction that
  pokes is often the claim itself.

---

## Phase E — Status-driven UX

- A successful write refreshes what it changed without a manual reload (D1's invalidation). A
  check-in resets the ring; a claim flips the role chip and the claimed flags.
- The `canClaim` false→true flip is visible on the heirs table and the claim page. Per
  `judging-criteria.md` it is the moment the demo exists for.
- The grace recovery path — checking in during Grace returns the estate to Active — is visible on
  the dashboard without a refresh.

---

## Phase F — Activity feed (The Graph)

The only remaining indexer need: the dashboard's activity card shows history, and history is
events.

**F1. Subgraph** in `frontend/subgraph/`, network `sepolia`, `startBlock: 11675256`, five data
sources (the five contracts in `addresses.ts`) sharing one schema:

- `Estate` (id = estateId)
- `ActivityEvent` (id = tx hash + log index): `estate`, `kind`, `timestamp`, `detail`

Handlers cover:

- `EstateOpened`, `HeirRegistered`, `HeirUnlocked`
- `CheckedIn`, `EnteredGrace`, `Unlocked`
- `Deposited`, `Withdrawn`
- `ClaimSettled`, `CheckInAttested`, `ClaimAttested`

Deploy with `graph deploy --studio herit` and query Studio's development endpoint. Publishing to
the decentralized network is out of scope.

**F2. Client.** `lib/subgraph/client.ts` — a typed `fetch` wrapper against
`NEXT_PUBLIC_SUBGRAPH_URL`, called from `useQuery`. No GraphQL library; `@tanstack/react-query` is
already installed. `useEstateActivity(estateId)` feeds `ActivityCard`.

**Fallback without infrastructure:** viem `getContractEvents` per contract, filtered on the indexed
`estateId`, from block 11675256, merged and sorted by block and log index. Fine at demo scale.
Page the block range if the RPC provider caps `eth_getLogs`.

---

## Out of scope

Heir removal (no contract support), per-token share overrides UI, a World App Mini App shell,
publishing the subgraph to The Graph Network, batching setup transactions into one wallet prompt.

---

## Verification

1. `npm run lint` and `npm run build` from `frontend/`, clean. No Solidity changes, so the forge
   steps are unaffected.
2. `grep` the build output for the RP signing key and attestor key: nothing.
3. Sepolia walkthrough with the World ID simulator or sandbox:
   1. **Setup.** Use a 2-minute interval, 1-minute grace, two heirs, and ETH plus MockUSDC.
      Reload mid-setup and confirm the checklist resumes.
   2. **Grace.** Check in. Let the window lapse → Grace. Check in again during Grace → Active.
   3. **Unlock.** Let it lapse fully. Without poking, the first heir claims — the claim transaction
      pokes. Confirm `canClaim` reads false before and true after.
   4. **Claims.** The second heir claims ETH and USDC.
   5. **Negatives.**
      - A heir dismisses the wallet prompt, then retries the claim → succeeds (Phase 0.1
        regression).
      - The grantor tries to claim → refused.
      - A different simulator identity tries to check in → refused.
      - Withdraw after unlock → disabled with a reason.
4. Open the app in a fresh browser with each wallet and no URL params: the grantor lands on their
   estate, each heir on their claim.
