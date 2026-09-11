# Over-delivering on a hackathon project — the observable behaviors

Using Herit as the worked example.

"Over-delivering" is usually said as a feeling: the team went further than they had to. That
version is unfalsifiable and therefore useless — every team believes it about themselves at 4am.
The useful definition is narrower.

**Over-delivering means the project leaves evidence a stranger can check without asking you
anything.** Not effort, not hours, not ambition. Evidence. A judge has twenty minutes, no
context, and no reason to take a claim on trust. What separates an over-delivered project from a
merely finished one is how much of it survives that person's skepticism when you are not in the
room to explain.

Everything below is a behavior with an observable trace. Each one lists what a stranger sees, the
instance of it in this repo, and the thing that imitates it without being it.

---

## 1. Claims about integrations are verified against the deployed reality, not the documentation

**Observable:** the repo contains the output of someone checking, with the discrepancy they found.

Most projects claim an integration. Some have one. The distinguishing artifact is a record of the
verification — specifically, a record of the moment the docs and the chain disagreed.

**In Herit:** `documents/deployments.md` compares every function Herit calls against the bytecode
actually deployed on Sepolia, selector by selector. Twenty-one match the pinned submodule. One
does not:

| | Signature | Selector |
|---|---|---|
| Submodule pin | `initialize(address,uint256)` | `0xcd6dc687` |
| Deployed | `initialize((address,uint256)[])` | `0x37cb53a8` |

The deployed `UserRegistryImpl` takes an array of `(account, roleBitmap)` pairs. Importing the
submodule's `UserRegistry` to initialize a proxy would have compiled, deployed, and reverted on
Sepolia with nothing in the error to say why. The file records the fix — declare a minimal local
interface — and why the submodule cannot be trusted here.

The same document records that `ETHRegistry.supportsInterface(0x6be50c69)` returns false, and
that this is expected rather than broken, so nobody re-derives that at midnight.

**The counterfeit:** a README listing sponsor logos and contract addresses. Addresses are cheap.
The observable is the *diff between what you were told and what is there*.

---

## 2. Being wrong is recorded in place, with the reasoning that was wrong

**Observable:** the design document contradicts its own earlier paragraph, on purpose, and says
what changed.

The instinct when a premise turns out to be false is to quietly edit it out. That produces a
document that looks confident and teaches nobody, including its authors six weeks later.

**In Herit:** `ARCHITECTURE.md` argues at length that a backend attestor is necessary because "no
chain today has both natively" — World ID's verifier and ENSv2. Directly beneath that argument:

> **One correction to that reasoning, found later and worth recording.** The premise "no chain
> today has both natively" is not quite true: the World ID Router *is* deployed on Ethereum
> Sepolia at `0x469449f251692e0779667583026b5a1e99512157`, alongside the ENSv2 hackathon set.

It then explains why the design does not change — on-chain verification is Orb-only, and Selfie
Check is the thesis — and where the correction *could* be used, at the heir claim, marked "noted
as an option, not built."

A judge who knows World ID will spot that the router is on Sepolia. Finding it already addressed,
with the limitation named, converts what would have been a hole into a demonstration of depth.
This is the highest-leverage version of the behavior: pre-empting the sharpest question you can
be asked.

The same pattern appears in `documents/checkpoint-10-guide.md`, which corrects the build plan's
own claim about why the nullifier is salted — "say that in the video rather than the stronger
claim; it is the one that survives a judge who knows the protocol."

**The counterfeit:** a "lessons learned" section written at the end, in the abstract. Corrections
belong next to the thing they correct, at the moment they are found.

---

## 3. Work is sequenced against what is irreversible, and the sequencing is stated

**Observable:** an audit dated *before* a deployment, with the reason it had to come first.

Every project has an ordering. An over-delivered one has an ordering derived from which mistakes
are recoverable.

**In Herit:** `documents/FRONTEND-AUDIT.md` opens:

> Run before Checkpoint 9.5, deliberately. Every dependency between the five contracts is
> `immutable` with no setter, so a missing function found after deployment is not a small fix —
> it is a redeploy of all five plus the two ENS root-role grants. Anything below marked ❌ has to
> be decided now or accepted permanently.

It then walks every button, form and rendered value in the frontend against the five contracts,
asking one question of each: can this be wired, or is it drawing something the chain cannot
answer. Two reverse lookups were missing entirely — `estatesOfGrantor` and `heirSlotsOf` — with
the consequence that a connected wallet had no way to find its own estates. Both were added
before deployment, when adding them was free.

The deployment itself carries the same shape: `make predict-herit` → `make deploy-herit-dry`
against a fork → `make deploy-herit` → `make check-herit`. The dry run is free and the real one
is not, so the free one runs first, every time.

**The counterfeit:** a long checklist. The observable is not that a list exists; it is that the
list is ordered by irreversibility and says so.

---

## 4. The system tests itself against reality, not against mocks

**Observable:** tests that fail if a third-party deployment changes.

**In Herit:** `test/unit/HeritForkTest.t.sol` and `test/integration/HeritLifecycleTest.t.sol` run
against a Sepolia fork with the real ENSv2 registry. `testWalletCanFindItsOwnEstates` exercises
the reverse lookup added in §3 against the live registry. `testStolenKeyCannotCheckIn` and
`testSameHumanCannotClaimTwice` encode the two attacks the product exists to prevent, as tests,
so "a stolen key cannot fake liveness" is a passing assertion rather than a sentence in a pitch.

Forty-five tests, all passing. More usefully: they test the *story*, which
`documents/fork-test-guide.md` insists on defining before any assertion is written —

```
3. canClaim(estateId, "son", son)  == false    ← the inheritance is DORMANT
4. unlockHeir(estateId, "son", son)            the grantor is presumed gone
5. canClaim(estateId, "son", son)  == true     ← the inheritance is EXERCISABLE
```

Steps 3 and 5 are the entire product, and they are two lines of a test.

**The counterfeit:** coverage percentage. A mocked integration at 100% coverage proves the mock
works.

---

## 5. The failure paths are built, named, and reachable by a user

**Observable:** error states in the UI that say what to do, mapped from the real error union.

Most hackathon demos have one path. The over-delivered version has the path where things go
wrong, because that is the path a judge finds by accident.

**In Herit:** `IDKitErrorCodes` is a 25-member union, and `selfie-check-modal.tsx` maps the ones
that can actually occur to sentences a person can act on — separating the ones a user can retry
(`user_rejected`), the ones that are a Portal setting and never a retry (`credential_unavailable`,
`world_id_3_not_available`), the ones that mean the environment is mismatched (`unknown_rp`,
`inactive_rp`), and the one that is the product working correctly (`nullifier_replayed` — "this
human has already used a check here", which is the sybil case and the one worth showing at
judging).

The contracts do the same thing: eleven named errors on `LivenessAttestor` alone
(`LivenessAttestor__WrongHuman`, `__CommitmentUsed`, `__SubjectMismatch`) rather than bare
`require` strings, so a revert names its own cause.

**The counterfeit:** a spinner, a `try/catch` that logs, and a toast that says "Something went
wrong."

---

## 6. Dead controls are found and removed before someone else finds them

**Observable:** a documented decision to delete something that was already built.

**In Herit:** the frontend audit found a trash icon on every heir row,
`aria-label="release the {label} heir slot"`, with no contract function behind it —
`grep -rniE "function (remove|revoke|delete|unregister)"` over `src/` returns zero matches. The
audit costs it out honestly (it would have to revoke the subname's role, decide what happens to
the resolver's `herit.share` record, and unwind `s_allocatedDefaultBps`) and concludes:

> **Recommendation: delete the button.** An inheritance product where the heir list only grows is
> defensible and easy to explain. A trash icon wired to nothing is not, and a judge will click it.

Two behaviors are visible at once: someone audited their own UI adversarially, and the outcome
was subtraction. Over-delivering is not only additive — shipping less surface that all works
beats more surface that mostly does.

**The counterfeit:** shipping the button and hoping nobody clicks it. They click it.

---

## 7. Derived artifacts are generated, and the generator is committed

**Observable:** a script that produces the thing, plus a comment explaining why it is not
hand-written.

**In Herit:** `frontend/scripts/sync-abis.mjs` copies ABIs out of Foundry's artifacts into
`lib/contracts/abis/*.abi.ts`. Its header states the reason: "no ABI in this app is written by
hand: the contracts are the source, and this makes the frontend's copy a build product of
`forge build` rather than something that drifts."

The value of this became concrete during deployment. The committed ABIs had gone stale against
the Checkpoint 9.4 additions — `livenessAttestor` was missing `checkIn` and `claim`, the two
write entrypoints the entire app routes through; `heritRegistry` was missing `estateOf`,
`deadlinesOf`, `heirAddressOf`, `defaultShareOf` and `heirSlotsOf`. Recovery was one command,
because the generator existed. Without it, the recovery is hand-copying five JSON blobs and
hoping.

**The counterfeit:** correct ABIs, pasted in once. They are correct exactly until the next
`forge build`.

---

## 8. Someone else can run it, and the commands are named

**Observable:** a Makefile or equivalent where every operation has a name and a help line, and
nothing requires a person to reconstruct a flag from memory.

**In Herit:** `make help` lists every `forge script` invocation the project has. The header
explains the one thing that is easy to get catastrophically wrong:

> Two flags appear on every broadcast and both are required: `--account` chooses the keystore
> that SIGNS, `--sender` sets `msg.sender` INSIDE the script. Foundry infers neither from the
> other. Omit `--sender` and `msg.sender` becomes Foundry's default account, whose private key is
> public — which on the deploy scripts would grant the registry's and resolver's root roles to a
> key anyone can spend from.

`DeployHerit.s.sol` then enforces it in code, refusing to run if `msg.sender` is Foundry's
default address. The knowledge is written down *and* made impossible to ignore.

Targets for scripts that do not exist yet fail with a pointer to the checkpoint that will write
them, rather than a missing-file error — the command shape decided once, in advance, rather than
rediscovered on the day.

**The counterfeit:** a README with a command block. The observable is that the commands are
executable and that getting them wrong is caught.

---

## 9. The rubric was read, and the self-assessment is unflattering

**Observable:** a scored self-assessment that rates something "very weak."

**In Herit:** `documents/judging-criteria.md` scores the project against ETHOnline's five
criteria on day one of the build:

| Criterion | Today | Achievable by submission |
|---|---|---|
| Technicality | Strong | Strong |
| Originality | Strong | Strong |
| Practicality | Weak | Moderate–strong |
| Usability (UI/UX/DX) | **Very weak** | Moderate |
| WOW Factor | Latent | Strong |

Under Practicality: "**This is the weakest criterion and the honest answer is no, not today.**"
Under Technicality, a list titled "What is missing" that begins "Three of five contracts are
empty."

The document's own framing is the point: "four of the five criteria are won or lost by decisions
already taken; only one of them is won by finishing the code." Knowing which of your problems
code can still solve — and which are already decided — is what makes the remaining hours
allocable.

**The counterfeit:** a self-assessment where everything is strong. It tells the reader nothing
and tells you less.

---

## 10. The work produces byproducts useful to people outside the project

**Observable:** an artifact whose audience is not the judges.

**In Herit:** `documents/research/feedback/worldid-selfie-check-feedback.md` is structured
feedback to World on six integration problems found while building — the action string being the
nullifier namespace with no warning at the point of choice, the documented
`UNIQUE (action, nullifier)` replay rule silently breaking recurring liveness, the mismatch
between `signRequest`'s output shape and `rp_context`'s input. Each is grounded in a specific
failure this build hit, with a proposed fix.

That document has no bearing on the score. It exists because the problems were real and someone
else will hit them. A sponsor reading it learns more about the integration's rough edges than
from any demo, which is itself a reason it is worth writing.

`documents/checkpoint-*.md` — eight build guides, roughly 2,460 lines — are the same shape aimed
inward: they explain the parts the official documentation cannot know, which is how a thing lands
in *this* repo.

**The counterfeit:** a blog post about the journey.

---

## What over-delivering is not

**It is not scope.** Five contracts that work beat eight that compile. Herit deliberately
excludes Safe module integration, on-chain World ID verification, and a guardian dispute
committee, and says so in `ARCHITECTURE.md §9` under "Explicitly out of scope." A named exclusion
reads as judgment; an unnamed one reads as an unfinished feature.

**It is not documentation volume.** The five thousand-odd lines in `documents/` are not the
achievement. What they enable is: every claim in them is checkable, and several of them recorded
a discrepancy that would otherwise have cost a day.

**It is not polish applied evenly.** Effort should be lumpy. Herit's technicality is finished and
its usability was rated very weak by its own authors, which is a defensible allocation as long as
it is deliberate.

---

## The tension worth naming

Over-delivering has an opportunity cost, and Herit currently demonstrates both sides of it.

The rigor is real: five contracts deployed and Etherscan-verified, forty-five passing tests
including fork tests against live ENSv2, a deploy script that predicts its own addresses and
walks the finished ring to confirm every pair agrees.

And as of this writing the frontend has no write path at all. `useWriteContract` appears zero
times. Five screens run on `lib/fixtures/estate.ts`. The Selfie Check modal completes the full
World ID round trip, receives a signed EIP-712 attestation, and does not send it anywhere.
`script/SetupEstate.s.sol` does not exist, so there is no estate on-chain to look at.

A judge cannot see any of §1 through §10 if the demo does not run. The behaviors above are
multipliers on a working product, not substitutes for one — which is the last observable, and the
one that governs the rest:

**11. The demo path is finished first, and everything else is finished around it.**

Herit has not yet done this. It is the entire remaining build, and no amount of the preceding ten
compensates for it.
