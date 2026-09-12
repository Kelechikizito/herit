# World ID Selfie Check — integration feedback

From building Herit (ETHOnline 2026), a proof-of-life inheritance protocol that uses Selfie
Check twice: as a recurring liveness gate for a grantor's check-in, and as a one-time sybil gate
on an heir's claim. Integration is `@worldcoin/idkit@4.2.3` with `selfieCheckLegacy`, Cloud
Verify v4, and an EIP-712 attestor contract on Ethereum Sepolia.

---

## The action string is the nullifier namespace, and nothing says so where you choose it

### What happened

The action is documented as an identifier for what a user is verifying for, registered in the
Developer Portal. It is also the thing that scopes the nullifier: same human, same RP, same
action produces the same nullifier; change one character of the action and you get an unrelated
nullifier that cannot be linked to the first.

Both facts are documented. They are not documented in the same place, and the second one is what
makes an action string a security parameter rather than a label. Nothing at the point of choosing
an action — the Portal's create-action form, the `action` prop on the widget — indicates that the
naming scheme decides whether the sybil guarantee holds.

The natural naming instinct makes it granular and descriptive, one action per distinct thing a
user does. That instinct is exactly backwards: granularity in the action string is how you give
one human several nullifiers.

### How it affected Herit

Herit's first design used `claim:${estateLabel}:${heirLabel}`, which reads correctly and is
wrong. One person registered as two heirs of the same estate — `son.alice` and `nephew.alice`,
both addresses they control — passes a check for `claim:alice:son` and gets nullifier N₁, then
passes one for `claim:alice:nephew` and gets N₂. N₁ ≠ N₂, the derived commitments differ, the
contract's `s_claimUsed[estateId][commitment]` never fires, and the estate pays out twice. The
sybil resistance that the entire World-track case rested on was off, and every test passed,
because each proof was individually valid.

A second failure had the same root. Herit's `LivenessAttestor` blocks a grantor from claiming
against their own estate by comparing the claim commitment to the one bound at first check-in.
With `checkin:alice` and `claim:alice` as separate actions, those commitments derive from
different nullifiers and can never be equal, so that check was dead code that looked live.

The fix was collapsing both to one action per estate, `herit:${estateLabel}`, and passing the
heir label as the proof's `signal` instead, which binds the proof to one heir without opening a
second nullifier namespace. Cost was an afternoon of reasoning that produced no code.

### Possible solutions

Put the nullifier consequence in the action's own documentation and in the Portal form, stated as
a rule rather than a property: one action is one uniqueness namespace, so an action should be as
coarse as the thing you want to be unique-per-human, and anything that varies per attempt belongs
in the signal. A worked wrong-example is worth more than a definition — the two-heir case above
takes four sentences.

The signal is the correct escape hatch and is under-sold in the same material. It appears as a
way to bind a proof to a transaction, not as the answer to "I need per-item context without
per-item nullifiers", which is the more common need.

- Concepts, actions and nullifier scope: <https://docs.world.org/world-id/concepts>
- IDKit integration reference: <https://docs.world.org/world-id/idkit/integrate>
- Sybil-resistance and signal usage patterns in `worldcoin/idkit-js`:
  <https://github.com/worldcoin/idkit-js>

---

## Selfie Check has no on-chain verifier, which puts a trusted signer inside an otherwise trustless design

### What happened

On-chain World ID verification via `WorldIDRouter.verifyProof` is `groupId = 1`, Orb credentials
only. Selfie Check is a Cloud Verify credential and has no on-chain path. Any contract that wants
to act on a Selfie Check must trust an off-chain party to attest that the check passed.

This is a reasonable consequence of how the credential works. It is not stated as a constraint in
the material that sells Selfie Check, so it is discovered at architecture time rather than at
evaluation time.

### How it affected Herit

Herit's premise is that a dead-man's switch needs *liveness*, not uniqueness — an Orb proof shows
a human is unique, not that they are alive today, and a stolen key can produce a stale Orb proof
just as easily as a stale timestamp. Selfie Check is the only credential that answers the actual
question, so it is load-bearing rather than decorative.

The cost is the entire `LivenessAttestor` contract: a backend verifies against Cloud Verify,
signs an EIP-712 message over `{estateId, subject, action, heirLabelhash, commitment, nonce,
expiry}`, and the contract checks that signature before touching estate state. That is roughly
250 lines of contract, a replay-protection scheme, a key that must be held for the life of the
protocol, and a single point of compromise documented in the threat model as the top item to
decentralize. A compromised attestor key can check in on behalf of a dead grantor, which is the
exact attack the product exists to prevent.

Worth noting what did not solve it: the World ID Router *is* deployed on Ethereum Sepolia at
`0x469449f251692e0779667583026b5a1e99512157`, alongside the ENSv2 hackathon set — verified live,
`routeFor(1)` returns a group-1 identity manager with a current merkle root. It is available and
still unusable here, because it verifies Orb proofs and Selfie Check is not one.

### Possible solutions

State the verification surface per credential in one table — credential, on-chain support,
cloud-only — so the trust boundary is visible before an architecture is committed to. Right now
the on-chain docs and the Selfie Check docs each describe a coherent world and the intersection
is left to the reader.

Longer term, the useful primitive is an attestation signed by a World-operated key over a Cloud
Verify result, with a published verifier contract. Every integrator building this pattern is
writing the same contract with a different domain separator and their own key custody, which is
worse for everyone than one audited verifier with World's key behind it.

- On-chain verification scope and Address Book: <https://docs.world.org/world-id/reference/address-book>
- Cloud Verify API: <https://docs.world.org/world-id/reference/api>
- Contracts and verifier interfaces: <https://github.com/worldcoin/world-id-contracts>

---

## The documented replay rule assumes one-shot uniqueness and breaks recurring liveness

### What happened

Anti-replay guidance is consistent across the docs and samples: store nullifiers, enforce
`UNIQUE (action, nullifier)`, reject on duplicate. It is correct for the airdrop-shaped case that
motivates it — one human, one claim.

Selfie Check is positioned as a liveness credential, and liveness is inherently recurring. A
recurring check produces the same nullifier every time by design, because the action and the
human are unchanged. The documented rule and the credential's purpose contradict each other, and
nothing flags it.

### How it affected Herit

Applied literally, the rule accepts a grantor's first check-in and rejects every subsequent one,
locking the estate into grace and then unlocking it to the heirs — the maximally destructive
failure for this product, reached by following the documentation correctly.

Herit's ledger instead mirrors the two rules the contract actually enforces, which are different
from each other and neither is plain uniqueness: for check-ins, estate → nullifier with
first-write-wins, so a *different* nullifier is the rejection (that is the stolen-key case); for
claims, `(estateId, nullifier)` unique among claims only. Deriving those took reading the
contract, not the docs.

### Possible solutions

Split the guidance by credential shape. "One human, one action, once" and "one human, one action,
repeatedly, and the repetition is the signal" are different storage schemas, and the second has no
worked example anywhere. For the recurring case the useful pattern is binding the nullifier on
first sight and comparing on every subsequent one, which detects the substitution attack — a
different human presenting for the same slot — rather than merely counting.

Also worth correcting in the samples: the in-memory `Set` used to illustrate nullifier storage
forgets everything on hot reload, which during development is every file save. It reads as a
placeholder for a database, but it fails in a way that looks like the proof system misbehaving.

- Cloud Verify and nullifier handling: <https://docs.world.org/world-id/reference/api>
- Sample integrations: <https://github.com/worldcoin/idkit-js/tree/main/examples>

---

## Portal configuration failures are indistinguishable from application bugs

### What happened

Three separate pieces of Developer Portal state cause the widget to produce no proof, with no
signal that the cause is configuration:

1. `app_mode` must be `external` for IDKit. A `mini-app` app rejects World ID config. This is
   fixed at app creation and cannot be changed.
2. Selfie Check is behind a per-app feature flag. A valid app and a valid action do not imply
   access, and enabling it is a conversation with a World contact rather than a setting.
3. An action registered in staging does not exist in production, and vice versa. A staging action
   only verifies against the simulator.

Each surfaces as the widget failing at the credential step or returning nothing. The error codes
that do exist — `credential_unavailable`, `feature_unavailable`, `world_id_3_not_available`,
`unknown_rp`, `inactive_rp` — are only useful if you already know they mean "stop debugging your
code".

### How it affected Herit

Herit's actions are per-estate and therefore not a fixed list registered once, which multiplies
the third problem: every new estate is a new action string that may or may not exist in the
environment being pointed at. The mitigation was pre-registering the demo estate's action by hand
in both environments and writing down that `herit:<label>` is the only correct form — because an
earlier draft of the design would have had us register `checkin:<label>` and `claim:<label>`,
which after the action fix above are strings the widget now never asks for. That is a silent
failure with three plausible wrong explanations and no error text distinguishing them.

We also spent time confirming `app_mode` was `external` on an already-created app, because
getting it wrong is unrecoverable and would have meant creating a second app at the demo table.

### Possible solutions

Surface the app's own state to the app. A read endpoint returning `app_mode`, enabled
credentials, and whether a given action exists in a given environment would turn all three
failures into a startup assertion with a precise message. Integrators are already reading env
vars at boot; one more call that says "this app cannot do Selfie Check" is worth more than any
amount of prose.

Failing that, distinguish the codes in the docs by remedy rather than by cause: which are retryable
by the user, which need a Portal change, which need a new app. `credential_unavailable` and
`user_rejected` are equally "failed" to the code and completely different to the operator.

The Developer Portal MCP server helps here and deserves more prominence — it makes app, RP and
action setup scriptable and is the only path that captures a new signing key without it passing
through a browser.

- Developer Portal MCP: <https://docs.world.org/model-context-protocol/developer-portal>
- Simulator for staging proofs: <https://simulator.worldcoin.org>
- IDKit reference, including the error-code union: <https://docs.world.org/world-id/reference/idkit>

---

## `signRequest` output does not fit `rp_context` input

### What happened

The server-side helper and the client-side prop are two halves of one handoff, and their field
names disagree. `signRequest` from `@worldcoin/idkit/signing` returns:

```ts
{ sig: string; nonce: string; createdAt: number; expiresAt: number }
```

`RpContext` expects `{ rp_id, nonce, created_at, expires_at, signature }`. Four of five names
differ, and `rp_id` is not in the signature output at all — it comes from the environment.

Because the handoff crosses a network boundary as JSON, nothing type-checks it. Passing the
signature object straight through compiles, serializes, deserializes, and hands the widget the
right values under the wrong keys.

### How it affected Herit

Caught by reading `@worldcoin/idkit-server`'s types before writing the route rather than after,
so the cost was minutes. Had it been caught at runtime the symptom would have been an invalid RP
signature with correct-looking inputs, which is a bad afternoon: the values are all present and
all correct, and the failure is in the key names.

It also propagated a documentation cost — the remap table now sits in Herit's own build notes
because it is load-bearing and non-obvious.

### Possible solutions

Export a function that does the remap, or make `signRequest` return the `RpContext` shape minus
`rp_id` so the server's job is a spread and one field. There is no reason for two shapes here;
the signing helper exists specifically to feed the widget.

If the shapes must stay distinct, ship a shared type for the wire format between them, so a
server returning the wrong keys fails at compile time on both ends.

- IDKit JS packages: <https://github.com/worldcoin/idkit-js>
- Integration reference: <https://docs.world.org/world-id/idkit/integrate>

---

## The v4 verify success shape is undocumented, so fail-closed logic is written against a guess

### What happened

`POST https://developer.world.org/api/v4/verify/{rp_id}` is the required server-side step, and
the response body's success shape is not specified anywhere we could find. A correct integration
has to decide "did this proof verify" from a body whose fields it is inferring.

Related, and confusing in the same area: for Selfie Check the response carries
`responses[].identifier: "selfie"`, while `face` exists as a backward-compatible alias for older
integrations. Both appear in circulation, and constructing `face` yourself is wrong.

Separately, `selfieCheckLegacy` is a World ID 3.0-backed credential, so `allow_legacy_proofs` is
required and results can arrive in the v3 shape — `protocol_version: "3.0"`, `responses[].proof`
a single string with `merkle_root` beside it — rather than the v4 shape where `proof` is a string
array. The nullifier is at `result.responses[0].nullifier` in both, which is the only reason this
is survivable.

### How it affected Herit

Herit's verify route contains a `looksVerified()` predicate that is explicitly a guess, written
to fail closed so a wrong guess rejects good proofs rather than accepting bad ones. That is the
safe direction, and it is still a security-critical branch written against an unknown contract,
carried in the build notes as an open caveat to confirm against the first real 200.

The v3/v4 result duality also cost time in the type layer, because the documented v4 result shape
and the shape a legacy-credential preset actually returns are different, and TypeScript surfaces
that as a union the samples do not show you handling.

### Possible solutions

Publish the v4 verify response schema, success and failure, with the exact field that means
verified. This is the single highest-value documentation fix in this list, because every
integrator writes a branch on it and cannot test the negative case without a deliberately invalid
proof.

Document `selfieCheckLegacy`'s result shape alongside the preset, including that it returns v3
protocol results. The preset knows what it produces; the type could narrow it.

Deprecate the `face` alias in the docs explicitly, so search results stop returning both.

- Cloud Verify API reference: <https://docs.world.org/world-id/reference/api>
- IDKit result types: <https://github.com/worldcoin/idkit-js>

---

## Summary

Selfie Check is the right primitive for Herit and no other credential substitutes for it: a
recurring liveness proof is what a dead-man's switch needs, and a uniqueness proof is not. Every
item above is an integration cost around a credential that works, not a complaint about the
credential.

The two with the widest blast radius are the action-naming semantics, because getting them wrong
produces a system that passes its tests and has no sybil resistance, and the absence of an
on-chain path, because it puts a trusted key in the middle of designs that are otherwise
trust-minimized.
