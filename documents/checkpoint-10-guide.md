# Checkpoint 10 — The verification backend

A build sheet for the World ID half of Herit: two route handlers in `frontend/app/api/`, one
swap inside the Selfie Check modal, and one small ledger. Signatures and rules only; the bodies
are yours.

This is the checkpoint where the demo stops being a timer. Everything up to now has been
simulated in `components/selfie-check/selfie-check-modal.tsx` — five stages on a `setTimeout`,
with the action string and nonce drawn on screen so the shape would not have to change when the
real path landed. It does not have to change. The stages stay; what advances them changes.

Source of truth for the World side is `https://docs.world.org/world-id/idkit/integrate`. This
guide is the part that document cannot know: how it lands in *this* repo, and the four places
where Herit's design and World ID's design disagree about a word.

---

## 0. What you already have

Checked, not assumed — read out of `frontend/` just now:

| Thing | State |
|---|---|
| `@worldcoin/idkit` | `^4.2.3` installed. Correct — v4 redesigned the API and every v2/v3 sample on the internet is wrong. |
| `lib/selfie-check.ts` | The vocabulary: `SelfieCheckPurpose`, `actionString`, `randomNonce`, the five stages. |
| `components/selfie-check/selfie-check-modal.tsx` | The simulated run. Used by the setup wizard, the dashboard proof-of-life card, and the claim card. |
| `app/api/` | Does not exist yet. |
| `.env.local` | Does not exist yet. |
| Developer Portal MCP | Not connected to this session. |

The Portal MCP would do the app, RP and action setup as tool calls instead of dashboard
clicking, and it is the only way to capture a new signing key without it passing through a
browser. Setup is at `https://docs.world.org/model-context-protocol/developer-portal`. You said
the app already exists, so this is optional — but §2 lists a thing about that app you have to go
and look at.

---

## 1. The round trip

```
  browser                     your server                  World
  ───────                     ───────────                  ─────
  open modal
     │  POST /api/worldid/sign  { purpose }
     ├──────────────────────────►
     │                          signRequest({ signingKeyHex, action, ttl })
     │   { app_id, action, rp_context }        ← RP_SIGNING_KEY never leaves here
     ◄──────────────────────────┤
  IDKitRequestWidget
     │  ─────────────────────────────────────────►  World App / simulator
     │  ◄─────────────────────────────────────────  IDKitResult (proof + nullifier)
     │
     │  POST /api/worldid/verify  { purpose, result, subject }
     ├──────────────────────────►
     │                          POST developer.world.org/api/v4/verify/{rp_id}   ─────►
     │                          ◄──────────────────────────────────────────────────────
     │                          commitment = keccak256(nullifier, NULLIFIER_SALT)
     │                          sign the EIP-712 Attestation
     │   { attestation, signature }
     ◄──────────────────────────┤
  wallet sends the tx to LivenessAttestor        ← Checkpoint 11
```

Two rules hold this together, and neither is negotiable:

- **Never sign the RP request on the client.** The signing key is what proves to the protocol
  that a proof request came from Herit. Leaked, anyone can forge requests as you. It is a
  server-only secret and it is never a `NEXT_PUBLIC_*` var, never logged, never returned.
- **Never verify a proof on the client.** The client can return any JSON it likes. Only World's
  verifier, called from your server, says whether a proof is real.

---

## 2. The word "action" means two different things

This is the trap that costs the afternoon, so it goes first.

`LivenessAttestor.Attestation` has a field called `action`. It holds `ACTION_CHECKIN` or
`ACTION_CLAIM` — two constants, and nothing else. It exists so a claim attestation cannot be
posted to `checkIn`.

World ID also has a thing called an action. It is a string, it is registered against your app in
the Developer Portal, and **it is what scopes the nullifier**. Same human, same RP, same action
string ⇒ same nullifier, every time. Different action string ⇒ a different nullifier that cannot
be linked to the first.

`lib/selfie-check.ts` currently builds the World ID action as:

```ts
checkin  ->  `checkin:${estateLabel}`
claim    ->  `claim:${estateLabel}:${heirLabel}`      // ← this one is wrong
```

**The claim action must not carry the heir label.** Here is the failure, concretely. One person
is registered as two heirs of the same estate — `son.alice` and `nephew.alice`, both pointing at
addresses they control. They pass a Selfie Check for `claim:alice:son` and get nullifier N₁.
They pass another for `claim:alice:nephew` and get nullifier N₂, because the action string
differs. N₁ ≠ N₂, so the two commitments differ, so `s_claimUsed[estateId][commitment]` never
fires, and `LivenessAttestor.claim` pays them twice. The sybil gate that the whole World track
pitch rests on is off.

**And there is a second failure with the same shape, one level up.** `LivenessAttestor.claim`
rejects a grantor claiming from their own estate by comparing the claim commitment against the
one the first check-in bound:

```solidity
if (s_estateCommitment[a.estateId] == a.commitment) revert WrongHuman;
```

With `checkin:alice` and `claim:alice` as separate actions those two commitments come from two
different nullifiers, so that comparison can never be true — even for the same person. The check
is dead code. So the action is **one namespace per estate, shared by both purposes**:

```ts
export function actionString(purpose: SelfieCheckPurpose): string {
  return `herit:${purpose.estateLabel}`;
}
```

Same human, same estate, same nullifier, whichever thing they are doing. Nothing on-chain
changes: the attestation's own `bytes32 action` still separates `checkIn` from `claim`, and
`checkIn` independently requires `subject == getOwner(estateId)`. The only thing given up is
unlinkability between a grantor's check-in and a claim on the same estate — which is precisely
the link the check needs. **Done — this is what `lib/selfie-check.ts` now does.**

The heir label passes as the **signal** instead — `selfieCheckLegacy({ signal: heirLabel })`.
The signal is folded into the proof and comes back as `signal_hash`; it binds the proof to one
heir without opening a second nullifier namespace. The heir is already carried to the contract
as `heirLabelhash` in the attestation, so nothing on-chain changes.

Check-in keeps `checkin:${estateLabel}` and is correct as it stands. Per-estate is what you
want there: the first check-in binds that estate to one human via `s_estateCommitment`, and the
same human checking into a *different* estate produces an unrelated nullifier, so the two
estates cannot be linked by anyone reading the chain.

While you are here, one honest correction to the build plan. It says the salt is what stops a
nullifier "linking the same human across every estate they touch". The estate-scoped action
already does most of that work — World hands you a different nullifier per estate regardless.
What the salt actually buys is that a raw nullifier is a *guessable* public value: anyone who
can obtain a proof for `checkin:alice` can compare its nullifier against what is on-chain and
learn whether that human is Alice's grantor. The salt breaks that test. Say that in the video
rather than the stronger claim; it is the one that survives a judge who knows the protocol.

---

## 3. Portal resources — go and check three things

You said the app exists. Confirm these before writing code, because two of them are fixed at
creation time and cost a new app to change:

1. **`app_mode` must be `external`, not `mini-app`.** IDKit needs `external`. A `mini-app` app
   is for MiniKit and will reject World ID config. This is set at create time and cannot be
   changed — if it is wrong, create a second app now rather than at the demo table.
   (ARCHITECTURE.md §6.1 wants a World App Mini App eventually. That is a MiniKit app and a
   separate Portal app; IDKit's widget already detects World App on its own via `isInWorldApp`,
   so the web path is the right one to build first.)
2. **Selfie Check (Beta) access.** `selfieCheckLegacy` is behind a feature flag on your app. A
   valid app and a valid action do **not** imply access. If the flag is off the widget fails at
   the credential step, and the only fix is asking your World contact — not code. Confirm it now.
3. **The actions exist in the environment you are pointing at.** A staging action only ever
   verifies against the simulator at `https://simulator.worldcoin.org`; a production action only
   signs proofs from a real World App. Point IDKit at the wrong one and you get zero proofs and
   what looks exactly like a frontend bug.

That last one has a wrinkle here: Herit's action strings are per-estate, so they are not a fixed
list you register once. Two ways out, pick one and write it down:

- **Create on the fly.** Pass `action_description` alongside the action; the Portal accepts
  actions it has not seen. Right for a real product.
- **Pre-register the demo estate.** For a hackathon with one estate on stage, create
  `herit:<demo-label>` in *both* environments by hand and be done. Fewer moving parts on demo day.
  Recommended.

  **One action, not two.** Since §2 collapsed check-in and claim into a single per-estate
  namespace, there is nothing called `checkin:<demo>` or `claim:<demo>` any more. Registering
  those instead is a silent failure: the widget asks for `herit:<demo-label>`, the Portal has
  never heard of it, and you get zero proofs and what looks exactly like a frontend bug.

---

## 4. Environment variables

`frontend/.env.local`, which is already gitignored. Write a `frontend/.env.example` next to it
with the same keys and empty values, so the teammate in Checkpoint 11 knows what to fill.

One trap: `frontend/.gitignore` ignores `.env*`, so `.env.example` is silently ignored too and
your teammate gets nothing. Either `git add -f frontend/.env.example`, or add a
`!.env.example` line under the `.env*` rule — the second, so it stays committed without anyone
remembering the flag. Same shape as the `docs/` trap in CLAUDE.md.

| Key | Public? | What it is |
|---|---|---|
| `NEXT_PUBLIC_WLD_APP_ID` | yes | `app_…` from the Portal. Public by design. |
| `NEXT_PUBLIC_WLD_ENVIRONMENT` | yes | `staging` or `production`. Read by both the widget and the sign route. |
| `WLD_RP_ID` | server | `rp_…`. Goes into the verify URL and into `rp_context`, so it does reach the browser — keep it server-read anyway so there is one place to change it. |
| `RP_SIGNING_KEY` | **server only** | The RP private key, hex. Never `NEXT_PUBLIC_*`. Never logged. Returned by the Portal exactly once; if it is lost the only path is rotation, which invalidates the old signer and needs a redeploy. |
| `NULLIFIER_SALT` | **server only** | Any 32 random bytes. Never leaves the server; see §2. |
| `ATTESTOR_PRIVATE_KEY` | **server only** | The EIP-712 signer. Must match `LivenessAttestor.I_SIGNER`. |
| `NEXT_PUBLIC_CHAIN_ID` | yes | `11155111`. |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | yes | Read by wagmi in the browser and by the verify route's chain pre-checks (§9). |

The attestor address is deliberately **not** a key. The route imports `herit.livenessAttestor`
from `lib/contracts/addresses.ts` for the EIP-712 domain, the same constant the client sends the
transaction to, so the two cannot drift and make every signature recover to the wrong signer.

Read the secrets inside the route handler, not at module top level, and throw a clear error when
one is missing. A route that silently signs with `undefined` fails much later and much worse.

You will need `viem` for the EIP-712 signing — `npm i viem` from inside `frontend/`. It is not
installed yet.

---

## 5. `POST /api/worldid/sign`

`frontend/app/api/worldid/sign/route.ts`. Route handlers in Next 16 are the Web `Request`/
`Response` APIs — `export async function POST(request: Request)` — and are not cached.

```ts
// in
{ purpose: SelfieCheckPurpose }

// out
{ app_id: string, action: string, environment: string, rp_context: RpContext }
```

Body:

```ts
import { signRequest } from "@worldcoin/idkit/signing";

const action = actionString(purpose);          // the same helper the client uses
const sig = signRequest({ signingKeyHex: process.env.RP_SIGNING_KEY!, action, ttl });
// -> { sig, nonce, createdAt, expiresAt }
```

**Verified against `@worldcoin/idkit@4.2.3`.** `@worldcoin/idkit/signing` re-exports from
`@worldcoin/idkit-core/signing`, which re-exports `@worldcoin/idkit-server`:

```ts
signRequest(params: SignRequestParams): RpSignature
  SignRequestParams = { signingKeyHex: string; action?: string; ttl?: number }
  RpSignature       = { sig: string; nonce: string; createdAt: number; expiresAt: number }
```

then shape it into the `rp_context` IDKit wants. **This remap is load-bearing** — four of the
five names differ and `rp_id` is not in the signature at all, so passing `sig` straight through
gives the widget the right values under the wrong keys, with nothing type-checking it across the
network boundary:

| `signRequest` returns | `RpContext` wants |
|---|---|
| `sig` | `signature` |
| `createdAt` | `created_at` |
| `expiresAt` | `expires_at` |
| `nonce` | `nonce` |
| — | `rp_id`, from the environment |

```ts
{ rp_id, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig }
```

`environment` is **not** a free string on the widget: it is `"production" | "staging" | "sandbox"`.
Validate it in the route and export the union, so the route's check and the widget's expectation
cannot drift. `lib/selfie-check.ts` exports `WLD_ENVIRONMENTS` for this.

Three rules:

- **The server derives the action, and returns it.** `signRequest` hashes the action into the
  signed message, so the action you sign and the action the widget requests must be identical to
  the byte. Have the client use the `action` in the response rather than recomputing it, and
  they cannot drift.
- **Return nothing else.** Not the key, not a fragment of it, not an error message containing it.
- `ttl` is the RP signature's lifetime, and it is a different clock from the attestation's
  expiry in §7. Keep it short — a couple of minutes is plenty for someone holding a phone.

---

## 6. The widget

Inside `SelfieCheckDialog`, replacing the `setTimeout` chain. The five stages stay; they now
advance on real events — stage 1 when the sign route returns, stage 2 when the widget opens,
stage 3 on the verify call, stage 4 when the attestation comes back, stage 5 when the wallet
has the transaction.

```tsx
import { IDKitRequestWidget, selfieCheckLegacy } from "@worldcoin/idkit";

<IDKitRequestWidget
  open={open}
  onOpenChange={setOpen}
  app_id={appId}
  action={action}
  rp_context={rpContext}
  preset={selfieCheckLegacy({ signal })}
  allow_legacy_proofs={true}
  environment={environment}
  onSuccess={(result) => { /* → §7 */ }}
  onError={(code, debugReport) => { /* → §8 */ }}
/>
```

**The backend call goes in `handleVerify`, not `onSuccess`.** The real prop list is
`{ open, onOpenChange, handleVerify?, onSuccess, onError?, autoClose?, language? }`, and
`handleVerify: (result) => MaybePromise<void>` runs *before* success. Throwing there rejects the
verification inside IDKit, so a proof your own server refuses never reaches the wallet. Put the
`/api/worldid/verify` call there; `onSuccess` is required by the type but only needs to close up.

**The widget cannot mount before the sign route returns,** because `rp_context` has to exist when
it renders. That is the two-phase shape of the modal, and it is also stage 1.

Five v4 things that break if you carry a v3 habit across:

- The widget is **controlled**. It takes `open` and `onOpenChange`. There is no function-as-child
  render prop; if you write one the widget simply never opens.
- `allow_legacy_proofs` is **required** by the type. `selfieCheckLegacy` is a World ID 3.0-backed
  credential, so it is `true` here.
- Because of that, `onSuccess` can hand you an `IDKitResultV3` — `protocol_version: "3.0"`,
  `responses[].proof` a single string with a `merkle_root` beside it — not the v4 shape where
  `proof` is a string array. Read the nullifier as `result.responses[0].nullifier`, which exists
  on both, and do not otherwise care.
- The type names lost their `I` prefix. `RpContext` and `IDKitResult`, not `IRpContext` /
  `ISuccessResult`.

The signal is the heir label for a claim (§2) and can be omitted for a check-in.

---

## 7. `POST /api/worldid/verify`

`frontend/app/api/worldid/verify/route.ts`. This is the one that matters.

```ts
// in
{ purpose: SelfieCheckPurpose, estateId: string, subject: `0x${string}`, result: IDKitResult }

// out
{ attestation: { estateId, subject, action, heirLabelhash, commitment, nonce, expiry }, signature }
```

In order:

1. **Forward the proof as-is** to `https://developer.world.org/api/v4/verify/${rp_id}`. Pass
   exactly what IDKit returned — do not re-encode a field, trim one, or rebuild a
   `verification_level` by hand. For Selfie Check the response carries
   `responses[].identifier: "selfie"`; `face` is only a backward-compatible alias for old
   integrations and you should not construct it. Mutating the payload is the most common cause
   of `invalid_proof`, and the second is a staging/production mismatch.
2. **Fail closed.** A non-2xx, or a body that does not say the proof verified, returns an error
   to the client. Never fall through to signing.
3. **Take the nullifier** — `result.responses[0].nullifier` — and compute
   `commitment = keccak256(abi.encode(nullifier, NULLIFIER_SALT))`. Whatever encoding you pick,
   write it down, because it has to be stable forever: `s_estateCommitment` binds an estate to
   the first commitment it ever saw, and a changed encoding turns every returning grantor into
   `WrongHuman`.
4. **Record the nullifier** — §9.
5. **Sign the attestation** with `ATTESTOR_PRIVATE_KEY` over the domain
   `{ name: "Herit", version: "1", chainId, verifyingContract: attestorAddress }`. Those two
   strings come from `EIP712("Herit", "1")` in the contract's constructor and must match
   character for character. The struct's field order must match `ATTESTATION_TYPEHASH`.
6. **Return the attestation and the signature.** The browser sends the transaction — the server
   never does, and holds no gas. `LivenessAttestor._verify` requires `a.subject == msg.sender`,
   so `subject` must be the wallet that will send it.

Two fields to get right:

- **`nonce` is random, not a counter.** `s_nonceUsed` in the contract is a single global mapping
  with no estate in the key, so two estates sharing a counter would collide and the second call
  would revert `NonceUsed`. Use 32 random bytes as a `uint256`.
- **`expiry` has a ceiling.** `MAX_ATTESTATION_LIFETIME` is 30 minutes, and `_verify` rejects an
  expiry beyond it just as hard as an expired one. Sign for a few minutes.

Also: `action` here is the on-chain constant — `keccak256("checkin")` or `keccak256("claim")` —
not the World ID action string from §2. Read §2 again if that sentence felt fine.

---

## 8. Errors the user can act on

Every failure below must reach the modal as a sentence, not as a spinner that never stops. The
existing dialog has no error state at all — that is the other half of the work in §6.

**Use the real codes.** `IDKitErrorCode` is a 25-member union and it does not contain
`invalid_proof` or `invalid_action` — both of those are prose, not API. Switch on these:

| Code(s) | What to say |
|---|---|
| `user_rejected`, `verification_rejected` | "the check was declined in World App" |
| `credential_unavailable`, `feature_unavailable`, `world_id_3_not_available` | "Selfie Check is not enabled for this app" — a Portal setting, not a retry |
| `nullifier_replayed` | "this human has already used a check here" — the sybil case, and the one worth showing at judging |
| `max_verifications_reached` | no verifications left for this action |
| `invalid_rp_signature`, `rp_signature_expired`, `timestamp_too_old` | the sign route's TTL lapsed while the user found their phone — start again |
| `unknown_rp`, `inactive_rp` | name the environment: this is the staging/production mismatch, and it looks like nothing happening |
| `invalid_network` | wrong network for this environment |
| `connection_failed` | could not reach World App |

A proof your own `/api/worldid/verify` route rejects never reaches `onError` — it surfaces as the
thrown error from `handleVerify`, so the modal needs both paths.

For JS failures, `onError`'s second argument is a `debugReport` (also `getDebugReport()`), and it
carries the transport, the `request_id`, and the request/response payloads. Keep it — log it,
show the `request_id` in the modal — and make sure nothing in that log path can print a secret.

---

## 9. The nullifier ledger

World's usual rule is `UNIQUE (action, nullifier)` — reject the duplicate on insert, never
"helpfully" upsert, because the duplicate is the attack.

**That rule is wrong here, and applying it literally locks every grantor out after one check-in.**
Check-in is deliberately recurring: the same human proves liveness every interval against the same
action, so they produce the same nullifier every time, by design. A uniqueness constraint would
accept the first check-in and refuse every one after it.

The contract enforces two rules, and they are not the same rule:

- `s_estateCommitment[estateId]` — the first check-in binds the estate to one human, and that human
  repeats forever. A *different* human is rejected — the stolen-key case.
- `s_claimUsed[estateId][commitment]` — one human, one claim per estate.

Herit has an unusual advantage here: **the chain is already that table.** Both rules are enforced
by `LivenessAttestor`, and both survive a server restart, a redeploy, and a wiped database. That is
the real anti-replay mechanism and it is worth a sentence at judging.

### Superseded: the file ledger

The first build kept a JSON file under `frontend/.data/` and wrote to it **before** signing. Nothing
ever removed an entry, and that broke real users:

- A claim that did not land (estate not unlocked yet, wallet prompt dismissed, attestation expired)
  left the heir refused forever with "already claimed", while the contract would have accepted them.
- A check-in bound the estate to whichever human verified first, even if that human never sent the
  transaction.
- A file under `.data/` does not survive a serverless deploy.

### Done: read-only pre-checks against the chain

`frontend/lib/server/preflight.ts` runs one `multicall` against Sepolia. The verify route calls it
after computing the commitment and before signing. Each check mirrors a revert the transaction
would hit:

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

Two checks do not read what the contract reads, on purpose:

- `statusOf` returns the *pending* status, so a lapsed estate that nobody has poked already reads
  `Unlocked`. `ClaimManager.claim` pokes first, so the claim is honoured.
- `ClaimManager` checks `gate.canClaim`, but the ENS role behind it is only granted by that poke.
  `canClaim` reads `false` before the claim transaction runs, so the route checks `heirAddressOf`
  instead.

Because the checks only read, an attestation that never lands leaves nothing behind, and the retry
passes.

The checks **fail open**. If the RPC call itself fails, the route logs the error name and signs
anyway. The contract still refuses a bad transaction; all that is lost is the early, gas-free
rejection. A violation that the checks *do* read fails closed, with a 400 the modal can show.

---

## 10. Do it in this order

1. §2 first — change `actionString` for claims and thread a `signal` through
   `SelfieCheckPurpose`. It is four lines and every step below bakes the result in.
2. §3 — go and look at the Portal. `app_mode`, the Selfie Check flag, the actions in both
   environments. Do not write code before this; two of those are unfixable later.
3. `.env.local` and `.env.example`, `npm i viem`.
4. §5, the sign route, alone. `curl` it and check you get an `rp_context` back and no secret.
5. §6, the widget, pointed at staging with the simulator. Getting a proof back at all is the
   milestone; do nothing with it yet but `console.log` that a nullifier exists.
6. §7 steps 1–3 — forward, fail closed, commit. Stop and confirm the verifier says yes.
7. §7 steps 5–6 — the EIP-712 signature. Check it against the contract before trusting it:
   `getMessageHash` is `public` for exactly this, so call it with your seven fields and compare
   the digest byte for byte. A mismatch here is the domain or the field order, nothing else.
8. §9, then §8.
9. `npm run lint` and `npm run build` from inside `frontend/`.

Step 7 is where this checkpoint either goes smoothly or eats the evening, which is the same
warning Checkpoint 9 carried, for the same reason.

---

## 11. You are done when

- `npm run lint` and `npm run build` are clean.
- A Selfie Check in the simulator produces a proof, your server verifies it against
  `developer.world.org`, and the modal reaches its last stage on real events rather than a timer.
- `RP_SIGNING_KEY` appears in exactly one file, is read inside a route handler, and grepping the
  built output for it finds nothing.
- A second claim by the same human is refused before signing, because `claimCommitmentUsed`
  already reads true. The contract would refuse it anyway.
- A second check-in for an estate, by a different human, is rejected — you can demonstrate this
  with two simulator identities, and it is the "the thief has the key and still cannot check in"
  moment the whole project is built around.
- Pointing `NEXT_PUBLIC_WLD_ENVIRONMENT` at `production` with a real phone also works, or you
  know exactly which Portal action is missing.
- You can say in one sentence why the nullifier is salted — the §2 version, not the build plan's.

Checkpoint 11 is the wallet: taking the attestation this returns and sending it to
`LivenessAttestor` from the browser. Nothing in this checkpoint should know what a wallet is.

---

## 12. Where this actually stands

Written and passing `npm run lint`, `npx tsc --noEmit` and `npm run build`:

| Piece | State |
|---|---|
| §2 the action fix | done — `herit:${estateLabel}`, one namespace per estate |
| the nonce | done — `randomNonce` deleted from the client; the verify route mints a full `uint256` |
| §5 `POST /api/worldid/sign` | done |
| §6 the widget | done — real events drive the five stages, with an error state |
| §7 `POST /api/worldid/verify` | done, with one caveat below |
| §9 the nullifier ledger | done: read-only chain pre-checks. The file ledger was removed (see §9). |
| §3 the Portal | `app_mode` confirmed `external`. Selfie Check flag and the actions still open. |

**The caveat in §7.** `looksVerified()` is a guess at the success shape, because no real 200 has
ever been read. It fails closed, so a wrong guess rejects good proofs rather than accepting bad
ones. Confirm it against the first real response and tighten it.

**The nonce is the server's to mint.** `randomNonce` was deleted rather than fixed: a nonce
generator sitting in shared client code invites someone to use it for the real attestation, and
only the backend that signs may choose one.

### The install trap

`npm install` will not repair a package whose extraction was interrupted. viem's directory looked
valid — `package.json` present, `_esm` complete at 1,473 files — while `_types` held 37 of ~2,900,
so `exports["."].types` pointed at a file that did not exist. npm saw the package as satisfied and
skipped it.

The symptom splits by tool, which is what makes it confusing:

| | Resolves via | Result |
|---|---|---|
| `tsc --noEmit` | `exports.types` → `_types/` | `TS7016: Could not find a declaration file for module 'viem'` |
| `next build` | `exports.import` → `_esm/` | passes — never mentions viem |

`rm -rf node_modules/viem && npm install`, or `npm ci`. And do not trust a green `next build`
alone: run `npx tsc --noEmit` too, because webpack never reads the type half. Both of the real
bugs in the widget wiring — a `string` where the union was wanted, and an error code that does
not exist — were invisible until viem's declarations landed.
