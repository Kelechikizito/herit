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

Fix it in `lib/selfie-check.ts`:

```ts
claim    ->  `claim:${estateLabel}`
```

and pass the heir label as the **signal** instead — `selfieCheckLegacy({ signal: heirLabel })`.
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
  `checkin:<demo>` and `claim:<demo>` in *both* environments by hand and be done. Fewer moving
  parts on demo day. Recommended.

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
| `NEXT_PUBLIC_ATTESTOR_ADDRESS` | yes | The deployed `LivenessAttestor`, for the EIP-712 domain. |
| `NEXT_PUBLIC_CHAIN_ID` | yes | `11155111`. |

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

then shape it into the `rp_context` IDKit wants:

```ts
{ rp_id, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig }
```

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

Four v4 things that break if you carry a v3 habit across:

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

| What happened | What to say |
|---|---|
| Selfie Check flag is off for the app | "Selfie Check is not enabled for this app" — it is a Portal problem, not a retry. |
| Action missing in this environment | Name the environment. This is the staging/production mismatch and it looks like nothing happening. |
| `invalid_proof` from the verifier | Retryable once; then say the proof was rejected. |
| Attestation expired before the tx landed | Offer the run again. Thirty minutes is generous but a demo can stall. |

For JS failures, `onError`'s second argument is a `debugReport` (also `getDebugReport()`), and it
carries the transport, the `request_id`, and the request/response payloads. Keep it — log it,
show the `request_id` in the modal — and make sure nothing in that log path can print a secret.

---

## 9. The nullifier ledger

World's rule is `UNIQUE (action, nullifier)`, column type `NUMERIC(78, 0)`, reject the duplicate
on insert. Do not "helpfully" upsert — the duplicate is the attack.

Herit has an unusual advantage here: **the chain is already that table.**
`s_estateCommitment[estateId]` is a one-writer-wins binding of an estate to a human, and
`s_claimUsed[estateId][commitment]` is a uniqueness constraint on claims. Both are enforced by
`LivenessAttestor`, and both survive a server restart, a redeploy, and a wiped database. That is
the real anti-replay mechanism and it is worth a sentence at judging.

What a server-side ledger adds is that a duplicate fails *before* the user pays gas to be
rejected, and that you can see it happening. For four days, a small table keyed
`(action, nullifier)` is enough — SQLite, or a JSON file under `frontend/.data/` that you
gitignore. Write down in the file's header that it is a demo store, so nobody reads it later as
a claim about production. The in-memory `Set` in World's sample is illustrative only; it forgets
everything on the next `next dev` reload, which during a demo is every time you save a file.

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
- The same nullifier submitted twice is refused by the ledger, and would be refused by the
  contract even if the ledger were empty.
- A second check-in for an estate, by a different human, is rejected — you can demonstrate this
  with two simulator identities, and it is the "the thief has the key and still cannot check in"
  moment the whole project is built around.
- Pointing `NEXT_PUBLIC_WLD_ENVIRONMENT` at `production` with a real phone also works, or you
  know exactly which Portal action is missing.
- You can say in one sentence why the nullifier is salted — the §2 version, not the build plan's.

Checkpoint 11 is the wallet: taking the attestation this returns and sending it to
`LivenessAttestor` from the browser. Nothing in this checkpoint should know what a wallet is.
