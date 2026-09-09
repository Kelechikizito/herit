# Herit against the ETHOnline judging criteria

Self-assessment, 2026-09-08, day 1 of the build. Companion to
[ARCHITECTURE.md](../ARCHITECTURE.md) (what Herit is) and
[build-plan.md](build-plan.md) (what gets built, in what order).

Every claim below is either verified in the repo or on Sepolia, or marked as not built yet.
The point of writing it now is that four of the five criteria are won or lost by decisions
already taken; only one of them is won by finishing the code.

---

## Scorecard

| Criterion | Today | Achievable by submission | Gap is |
|---|---|---|---|
| Technicality | Strong | Strong | Already banked |
| Originality | Strong | Strong | Already banked |
| Practicality | Weak | Moderate–strong | Three empty contracts, one broken resolver call |
| Usability (UI/UX/DX) | Very weak | Moderate | The frontend is a stock Next.js page |
| WOW Factor | Latent | Strong | Nothing is demoable yet |

"Today" is what a judge would see if judging started this minute. The distance between the
two columns is the whole remaining build.

---

## 1. Technicality

> *How complex is the problem you're addressing, and how sophisticated is your solution?*

### The claim

Herit's difficulty is not "write a dead-man's switch". That part is a timestamp comparison.
The difficulty is that the two things a dead-man's switch actually depends on — *is the
owner alive* and *is this the rightful heir* — are exactly the two things a smart contract
cannot see. Herit answers both with primitives that did not exist a year ago, and the
answers land in different places: World ID lives on World Chain, ENSv2 exists only on
Sepolia, and no chain hosts both.

### Evidence in the repo today

**Enhanced Access Control used as an authorization system, not a label.** ENSv2's role
bitmap packs 64 roles into a `uint256` as nybbles: a role at nybble *N* sits at bit `4N`,
its admin counterpart 128 bits higher. `RegistryRolesLib` occupies nybbles 0–9 and 30–31.
`src/libraries/HeritRolesLib.sol` claims nybbles 10 and 11 for `ROLE_HEIR_CLAIM` and
`ROLE_HEIR_REGISTERED`, in the free range, alongside ENS's own roles rather than beside
them:

```solidity
uint256 internal constant ROLE_HEIR_CLAIM = 1 << 40;              // nybble 10
uint256 internal constant ROLE_HEIR_CLAIM_ADMIN = ROLE_HEIR_CLAIM << 128;
```

So unlock is literally `grantRoles(heirLabel, ROLE_HEIR_CLAIM, heir)` **inside the real ENS
registry**, and the claim gate is `hasRoles`. There is no parallel boolean in Herit's
storage that the ENS state merely mirrors. This is the single most technical thing in the
project and it is finished.

**A three-level registry hierarchy, deployed per estate.** `herit.eth` → registry A (one
name per grantor) → registry B (one per estate, holding that grantor's heirs). Registry B is
deployed through the `VerifiableFactory` inside `openEstate`, so a grantor's whole estate is
one transaction. `AccessControlGate.predictEstateRegistry` recomputes the CREATE2 address
off-chain by reproducing the factory's own arithmetic — the factory hashes the caller into
the salt and appends the result to the clone's runtime, so the salt appears twice:

```solidity
bytes32 outerSalt = keccak256(abi.encode(address(this), _estateSalt(estateId)));
address logic = IVerifiableFactoryLogic(address(I_VERIFIABLE_FACTORY)).proxyLogic();
return Create2.computeAddress(
    outerSalt, keccak256(CloneProxyBytecode.creationCode(logic, outerSalt)), address(I_VERIFIABLE_FACTORY)
);
```

Verified live: `script/DeployRegistryA.s.sol` simulated against Sepolia predicts
`0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21` and deploys to the same address.

**Non-obvious ENSv2 failure modes found and handled, in the code, with reasons.** These are
the details that separate "read the docs" from "used the thing":

- A role granted on an **expired** name is written to `eacVersionId + 1`, a resource id
  nothing reads. The grant appears to succeed and silently does nothing. `unlockHeir`
  therefore refuses to unlock into a lapsed estate and renews the heir subname up to the
  estate's expiry first — which is why `GATE_ROOT_ROLE_BITMAP` carries `ROLE_RENEW`.
- Every grant and revoke **burns and re-mints** the subname token through `_regenerate`, so
  a cached token id is a bug waiting to fire. The gate addresses names by labelhash
  throughout and says so at the one place it returns a token id.
- `PermissionedRegistry.renew` on an already-expired name takes the `_canRevive` path,
  gated on root `ROLE_RENEW` on **that** registry. Registry A is not deployed by the gate,
  so the deploy script grants it explicitly; without it, a lapsed grantor name is
  unrecoverable and `renewEstate` reverts for every caller.
- ENSv2 does not cap a child's expiry against its parent's, so `registerHeir` enforces it.

**A constructor-cycle broken with CREATE2 rather than a setter.** `HeritRegistry` needs the
gate's address; the gate needs `HeritRegistry`'s. The gate keeps every dependency
`immutable` and takes the predicted address, so the one privileged caller is fixed in
bytecode at deployment. A post-deploy setter would have left both a window and a permanent
function through which the privileged caller could be repointed.

**Liveness that a stolen key cannot fake.** Selfie Check is the point of the World
integration: a recurring *liveness* proof, which is the one thing a `lastActive` timestamp
cannot give. It is a Cloud Verify-only credential, so a backend verifies it and signs an
EIP-712 attestation that `LivenessAttestor` checks on Sepolia — a narrow, single-purpose,
domain-separated key that holds no funds and can only assert that a check passed.

What makes it more than an assertion is the nullifier. Cloud Verify returns one that is stable
per human, so the first check-in binds the estate to a salted commitment of it, and every later
check-in must match. A compromised key cannot check in, because the thief is a different human.
The salt keeps a raw nullifier off-chain, where it would otherwise link the same person across
every estate they touch.

### What is missing

Three of five contracts are empty (`HeritVault`, `ClaimManager`, `LivenessAttestor` are 4
lines each; `HeritRegistry` is a 58-line shell with one view function). The state machine
that *decides* unlock does not exist, so the most technical component currently has no
caller.

### How we build it

Checkpoints 6–9 of the build plan, in order: `HeritVault` (snapshot balances at unlock, not
at first claim, or a mid-claim deposit changes what a share means), `HeritRegistry` (the
two-stage timer and the per-heir-per-token share matrix), `ClaimManager` (reads its answer
from ENS via `canClaim`), `LivenessAttestor` (EIP-712 attestations only, with the action, the
nonce and the per-estate nullifier commitment all checked).

---

## 2. Originality

> *Is your project introducing a new idea or creatively solving an existing problem?*

### The claim

Crypto inheritance is a crowded idea and almost every entry gets the same two things wrong.
Herit's originality is not the category, it is the two substitutions:

| Everyone else | Herit |
|---|---|
| Proof of life = last transaction timestamp | Proof of life = World ID **Selfie Check** (liveness + uniqueness) |
| Heir = an address in an array | Heir = an **ENS subname holding a role**, granted in the real registry |

Both substitutions attack a real failure, not a cosmetic one. A `lastActive` timestamp
refreshed by any transaction is trivially gamed: a bot, a delegated signer or a compromised
key can all "prove" the owner is alive. A stolen private key cannot pass a biometric
liveness check. And an address has no verifiable link to a unique human, which is what makes
sybil heirs possible — one person registering many heir slots to siphon an estate.

### Evidence in the repo today

**Same primitive, two different jobs.** World ID is used twice for genuinely different
purposes — a *recurring* liveness loop for the grantor, and a *one-time* personhood gate for
the heir — scoped by action string (`checkin:{estateId}`, `claim:{estateId}:{heirLabel}`) so
a proof cannot be replayed across estates or across the grantor/heir roles. Most projects
use World ID once, as a signup gate.

**The name model was redesigned mid-plan, and the redesign is the interesting part.**
`ARCHITECTURE.md` assumed the grantor already owns `alice.eth`. That means every user buys a
`.eth` name — 8 USDC, a 60-second commit wait, two transactions — before Herit does anything
for them. Herit instead owns `herit.eth` and issues grantor names beneath it, so onboarding
is one free transaction. Registered and verified on Sepolia: `herit.eth`, owner
`0x9C0e…9418`, status `REGISTERED`, expiry 2027-09-08.

**The dormant-then-granted role is, as far as we can tell, novel.** The heir's subname
exists from day one and is visibly theirs, carrying `herit.relationship` and `herit.share`
records — but the bit that authorizes claiming is *withheld at registration* and granted at
unlock. `HEIR_REGISTRATION_ROLE_BITMAP` withholds `ROLE_HEIR_CLAIM` deliberately; that
withheld bit **is** the inheritance. An heir can be shown their inheritance, and read its
terms, for years before they can act on it.

**`canClaim` asks two questions in one call.** `hasRoles` requires the whole bitmap, so
checking `ROLE_HEIR_CLAIM | ROLE_HEIR_REGISTERED` asks both "has this estate unlocked for
this heir" and "did Herit create this subname at all" — the second bit is what stops a name
that acquired the claim bit by some other route from passing.

### What is missing

Nothing structural. Originality is decided by the design and the design is done. The risk is
purely presentational: if the video shows a countdown timer and a balance, it looks like
every other dead-man's switch. The `hasRoles` false→true contrast on the real registry is
what makes it different, and it has to be *shown*, not described.

### How we build it

Checkpoint 13. Put the ENS state on screen: `hasRoles` returning false, the unlock, then
`hasRoles` returning true, with the two text records visible on the subname throughout.

---

## 3. Practicality

> *How complete and functional is your project? Could it be used by its target audience today?*

**This is the weakest criterion and the honest answer is no, not today.**

### Evidence in the repo today

What works:

- `herit.eth` is registered on the frozen ENSv2 hackathon set (not the regular Sepolia beta
  set, which is a different group of contracts entirely — a name registered there would be
  invisible to Herit).
- `AccessControlGate` compiles at 11,124 B runtime with 13,452 B of margin, so it does not
  need splitting even carrying proxy deployment.
- `script/DeployRegistryA.s.sol` simulates cleanly end to end against live Sepolia state
  (~339k gas), including the array-form `initialize` and `setSubregistry`.
- `documents/deployments.md` is a real audit: every function Herit calls was checked
  selector-by-selector against the deployed bytecode, which caught that the deployed
  `UserRegistryImpl` takes `initialize((address,uint256)[])` (`0x37cb53a8`) where the pinned
  submodule declares `initialize(address,uint256)` (`0xcd6dc687`).

What does not:

- **Three contracts are empty and one is a shell.** No vault, no claim path, no attestor, no
  state machine. Nothing can be inherited yet.
- **`registerHeir` reverts on Sepolia.** Selector scan of the deployed
  `PermissionedResolverImpl` (`0xa9d3…614e`, 59 selectors) shows the resolver is
  **name-based**, not node-based: it exposes `setAddress(bytes,uint256,bytes)`
  (`0xb4436dde`) and `setText(bytes,string,string)` (`0xc7279f88`), and does **not** expose
  the `setAddr(bytes32,uint256,bytes)` (`0x8b95dd71`) or `setText(bytes32,string,string)`
  (`0x10f13a8c`) that `_writeHeirRecords` calls. Its initializer is
  `initialize((address,uint256)[],bytes[])` (`0x33cc44a0`), matching neither the submodule
  nor the docs.
- **There are no tests.** `test/unit/HeritForkTest.t.sol` exists and is empty.
- **World ID Sandbox access has not arrived**, so no real Selfie Check has ever run.

### How we build it

In priority order, because this is where the remaining hours should go:

1. **Fix `_writeHeirRecords` for the name-based resolver** (half a day). It needs
   DNS-encoded names (`\x03son\x05alice\x05herit\x03eth\x00`) instead of namehashes. This
   *simplifies* the gate: `I_HERIT_NODE` and `_childNode` exist only to build namehashes for
   the resolver, and a DNS name is built by concatenating length-prefixed labels already
   held in calldata, with no parent hash to supply. Confirm the exact encoding against the
   live contract first — the setter is role-gated, so a malformed name fails as a permission
   error rather than an encoding one.
2. **Checkpoint 5 end to end** (half a day). `openEstate`, `registerHeir`, `unlockHeir`,
   `canClaim` false→true, run with `cast` against real Sepolia. Note that the ENS-track proof
   does not depend on the resolver setters at all — only the two text records do — so this is
   reachable before item 1 lands.
3. **Checkpoints 6–8** (day 2). Vault, state machine, claim path.
4. **Fork tests for the happy path.** Local unit tests against the submodule would test a
   *different* implementation than what is deployed — the `initialize` mismatch alone would
   revert `openEstate` locally while working on-chain. `vm.createSelectFork("sepolia_eth")`
   is the only honest fixture. Assert that the heir's token id **changes** across
   `unlockHeir`; that is the test that catches a future caching mistake.

Target for "practical": one estate, two heirs, ETH plus the deployed `MockUSDC`, running on
Sepolia, claimable. Demo timers in minutes, not months, so the whole cycle fits in a video.

---

## 4. Usability (UI/UX/DX)

> *How intuitive is your project? Have you made it easy for users to interact with your solution?*

**This is the largest gap between what the design promises and what exists.**

### Evidence in the repo today

`frontend/app/page.tsx` is 69 lines of stock Next.js template — the "edit page.tsx" starter.
`frontend/package.json` lists `next`, `react`, `react-dom` and nothing else: **no wagmi, no
viem, no MiniKit, no IDKit, no ensjs.** A judge opening the frontend today sees the Next.js
logo.

The DX half is genuinely strong, and it is worth pointing at during judging because it is
real and it is unusual:

- `documents/deployments.md` — a full selector-level audit of the deployed contracts against
  the pinned submodule, including the three signatures that differ and why importing the
  submodule's types would silently produce init data the proxy rejects.
- `documents/build-plan.md` — 13 checkpoints, each with what to understand first, what to
  write, how to check it, and what gets verified.
- Deploy scripts document their own failure modes: `RegisterHeritRoot` refuses to run as
  Foundry's default sender, because `--account` chooses the signer while `--sender` sets
  `msg.sender`, and registering `herit.eth` to a public private key would hand the project's
  root name to anyone.
- CI runs `forge fmt --check`, `forge build --sizes`, `forge test -vvv`, and formatting is
  enforced rather than suggested.

### What is missing

Everything a user touches.

### How we build it

Checkpoint 11 hands the teammate the ABIs, deployed addresses and trigger payload shape.
The minimum that reads as a product:

- **Grantor view** — a countdown to the next check-in, one button that opens Selfie Check,
  and the heir list with each heir's relationship and share read from their ENS records.
- **Heir view** — "your inheritance is dormant / exercisable", the subname shown as a name
  rather than an address, and a claim button that is disabled until `canClaim` returns true.
- **The status transition visible in the UI**, not just in an event log.

Two dependencies to resolve early, both outside our control: the Selfie Check flag on the
app id (separate from sandbox app access), and the `selfieCheckLegacy({ signal })` preset
from IDKit.

One thing worth building even if the rest slips: the heir view. "Here is a name that is
yours, here is what it says you inherit, here is why you cannot claim it yet" is the whole
product in one screen, and it needs only reads.

---

## 5. WOW Factor

> *Does your project leave a lasting impression?*

### The claim

Herit has one moment, and it is a good one:

> A permission that lives inside ENS itself flips from false to true because a human stopped
> proving they were alive.

Not a boolean in our storage. Not an event we emit. A role in the registry that ENS resolves
for anyone who asks, on a name a judge can look up themselves.

The second-order moment is the recovery path: the grantor comes back during grace, passes a
Selfie Check, and the estate returns to Active. A dead-man's switch that can be *undone by
being alive* reads as a real product rather than a demo.

### Evidence in the repo today

The mechanic is written and compiles, and the ENS foundation is registered on Sepolia. It
has never been run. There is no demo, no video, no deployment beyond `herit.eth`.

### What is missing

The thing itself, on screen.

### How we build it

Checkpoint 12 (`script/RunDemo.s.sol`: fund the vault, set interval and grace to minutes,
check in, wait, poke to Grace, poke to Unlocked, claim as each heir) and checkpoint 13. Run
it end to end at least twice before recording.

Three specifics that decide whether the moment lands:

1. **Show the registry, not our UI, for the flip.** A `cast call` returning `false`, the
   unlock, the same call returning `true`. Judges have seen a hundred dashboards change
   colour. They have not seen an ENS role change hands.
2. **Show the records on the subname.** `herit.relationship` and `herit.share` visible on
   `son.alice.herit.eth` makes the heir a person with terms rather than an address with a
   number.
3. **Show the grace recovery.** It takes fifteen seconds and it is the difference between a
   scary toy and something you would actually put assets in.

---

## Cross-cutting risks

| Risk | Effect on score | Mitigation |
|---|---|---|
| World ID Sandbox access never arrives | Practicality, and the World track directly | Drive the backend with a recorded Selfie Check payload; every other layer is unchanged and the video says so plainly |
| Frontend stays a stub | Usability, and it caps WOW | Build the heir read-only view first; it needs no writes and it is the most legible screen in the product |
| The resolver rewrite eats a day | Practicality | Checkpoint 5's headline result does not depend on the resolver setters — prove the role flip first, records second |
| `documents/research/feedback/world.md` stays empty | It is **25% of the World track score** and is currently 0 bytes | Log rough edges as they happen; write it up in your own voice on day 4 |

---

## The three things that move the most points

Ordered by points per hour, given where the project actually is:

1. **Run checkpoint 5 on Sepolia.** It converts the strongest thing in the project from a
   claim into a demonstration, and it is roughly a day of work away.
2. **Build the heir view.** Usability is the lowest-scoring criterion and the cheapest to
   raise, because the most compelling screen in the product is read-only.
3. **Write `world.md` as you go.** A quarter of one track's score, currently empty, and it
   costs nothing but attention while the rough edges are still fresh.
