# Herit — four-day guided build

Companion to [ARCHITECTURE.md](../ARCHITECTURE.md). That document says what Herit is; this
one says what gets built, in what order, and who writes each piece.

**Kelechi writes the contracts. Claude explains, reviews and unblocks.** Each checkpoint
states what is being built and why, what to understand before starting, what to write, how
to check it, and what gets verified at the stop. Claude writes only what is not worth the
four days: mocks, deploy scripts, and the running feedback log.

---

## Progress

- [x] 1 — Make the repo build
- [x] 2 — Pin the deployment and register `herit.eth`
- [x] 3 — Define Herit's own ENS roles
- [x] 4 — AccessControlGate
- [x] 5 — Prove the mechanic on-chain
- [x] 6 — HeritVault
- [ ] 7 — HeritRegistry
- [ ] 8 — ClaimManager
- [ ] 9 — LivenessAttestor
- [ ] 10 — The verification backend
- [ ] 11 — Hand off to the frontend
- [ ] 12 — The demo script
- [ ] 13 — Record and submit

---

## Starting state

Verified in the repo at the time of planning:

- All five contracts in `src/` are empty stubs. `src/HeritRegistry.sol:60` does not compile:
  an `isAvailable` body was copied from the ENS tutorial and the type `IPermissionedRegistry`
  was replaced with the address variable `I_PERMISSIONED_REGISTRY`, leaving `REGISTRY`
  undeclared.
- `frontend/app` is the stock Next.js page. A teammate owns the frontend.
- `test/` holds only the Foundry template. Tests are written only on request.
- `foundry.toml` already remaps `@ensdomains/contracts-v2/`, so CLAUDE.md's note that the
  remapping is missing is stale.

---

## Two decisions that changed the architecture

### 1. The heir's right to claim lives in ENS, not in Herit's storage

`PermissionedRegistry._getSettableRoles`
(`lib/contracts-v2/contracts/src/registry/PermissionedRegistry.sol:557`) returns
`roleBitmap >> 128` for a name resource, and the base `_getSettableRoles`
(`lib/contracts-v2/contracts/src/access-control/EnhancedAccessControl.sol:418`) folds in
ROOT_RESOURCE roles. An account holding a root **admin** bit can therefore grant the
matching regular role on any subname.

`RegistryRolesLib` occupies nybbles 0–9 and 30–31, leaving 10–29 free. Herit defines its own
roles in those free slots, so unlock is literally
`grantRoles(heirLabel, ROLE_HEIR_CLAIM, heir)` inside the real ENS registry, and the claim
gate is `hasRoles`. Enhanced Access Control does the work its name describes rather than
sitting beside a boolean we keep ourselves.

### 2. Selfie Check is the thesis, so the attestor is an EIP-712 verifier

Selfie Check is what makes Herit's dead-man's switch different from a `lastActive` timestamp:
a recurring *liveness* check, not a signature. It runs on World ID 3.0 and is verifiable
**only through the Cloud Verify API**, so a backend sits between the proof and the chain. That
is a constraint of the credential, not a design preference.

`LivenessAttestor.sol` therefore verifies an **EIP-712 attestation** signed by the backend after
Cloud Verify returns a pass: `{estateId, subject, action, nonce, expiry}`. Action-scoping and
the nonce stop a check-in proof being replayed as a claim, or across estates. The user sends
the transaction, so the backend never needs gas or an on-chain key.

**A finding worth recording, which does not change this.** The World ID Router *is* deployed on
Ethereum Sepolia at `0x469449f251692e0779667583026b5a1e99512157`, next to the ENSv2 set —
verified live, `routeFor(1)` returns `0xb2EaD588f14e69266d1b87936b75325181377076` with a current
root and `verifyProof` reverts `NonExistentRoot()` on junk. But on-chain verification is
`groupId = 1`, Orb only, and Selfie Check is not an Orb credential. It stays available for the
**heir claim**, which is a one-time uniqueness gate rather than a liveness one. Optional, and
only if the ENS and World halves are finished early.

**The nullifier is still the interesting part.** Cloud Verify returns a nullifier that is stable
per human per action, so the backend can bind an estate to a person: the first check-in records
`keccak256(nullifier, salt)` against the estate, and every later one must match. A stolen key
cannot check in, because the thief is a different human. Salted, because a raw nullifier would
link the same person across every estate they touch.

---

### 3. Herit issues the grantor's name

`ARCHITECTURE.md` assumes the grantor already owns `alice.eth`. In practice that means every
user buys a `.eth` name — 8 USDC, a 60-second commit wait and two transactions — before
Herit does anything for them. Instead Herit owns `herit.eth` and issues grantor names under
it, so onboarding is a single free transaction.

```
herit.eth                          Herit owns, registered via ETHRegistrar
  └─ UserRegistry A                AccessControlGate holds ROLE_REGISTRAR
       └─ alice.herit.eth          a grantor, one tx, free, instant
            └─ UserRegistry B      deployed per estate via VerifiableFactory
                 ├─ son.alice.herit.eth     heir
                 └─ kate.alice.herit.eth    heir
```

Three levels of registry, each nested in the one above. ENSv2 supports arbitrary depth as
long as the parent grants the permissions, and this is the structure the redesign exists to
express. The heir role grant at unlock happens in registry B.

## Decisions taken

| Question | Decision |
|---|---|
| Heir shares | Percentage per heir per token, a two-key matrix |
| Death proof | Timer and grace only. No executor, no death oracle |
| Clock transitions | Open to any caller, driven by a script on cue |
| World ID credential | Selfie Check (`selfieCheckLegacy`), protocol 3.0 — the liveness thesis |
| World ID verification | Cloud Verify in the backend, then an EIP-712 attestation checked on Sepolia |
| Attestor contract | Signed attestations only. No owner override, no unsigned fallback |
| Proof binding | `{estateId, subject, action, nonce, expiry}`, so a proof cannot move between estates or between check-in and claim |
| Nullifier | Salted, bound to the estate on first check-in, required to match on every later one |
| Unlock reach | Heir subnames only, the grantor's own name is untouched |
| Name model | Herit owns `herit.eth` and issues grantor subnames under it |
| Registration | Grantor onboarding is one free transaction, no commit wait |
| ENS records | `herit.relationship` and `herit.share` on each heir subname |
| Demo assets | ETH plus the deployed `MockUSDC` and `MockDAI`, so no token to deploy |
| Demo clock | Minutes |
| Tests | Only on request |
| If time runs out | One estate, two heirs, ETH plus one token. ENS ships first, World second |

---

## Architecture

```
Frontend (teammate)
  └─ IDKit selfieCheckLegacy preset → proof payload
        │
        ▼
Herit backend  (Next.js route handler)             ← Claude writes
  ├─ POST developer.world.org/api/v4/verify/{rp_id}
  ├─ keccak256(nullifier, NULLIFIER_SALT)
  └─ EIP-712 sign { estateId, subject, action, nonce, expiry, commitment }
        │ handed back to the user, who sends the transaction
        ▼
LivenessAttestor.checkIn / .claim  (Sepolia)
  ├─ ECDSA.recover == HERIT_ATTESTOR
  ├─ nonce unused, expiry in the future, action matches the entrypoint
  ├─ checkin → commitment must match the one bound to this estate
  ├─ claim   → commitment must be unused for this estate
  └─ then:
       ├─ HeritRegistry.checkIn(estateId)
       └─ ClaimManager.claim(estateId, heirLabel)
        │
HeritRegistry ──unlock──▶ AccessControlGate ──▶ estate UserRegistry B
                                                 grantRoles(heirLabel,
                                                   ROLE_HEIR_CLAIM, heir)
ClaimManager ──hasRoles?──▶ estate UserRegistry B
             ──release────▶ HeritVault
```

---

## Track gates

- **World ID Sandbox access** — requested, awaiting a response. Needed to run a real Selfie
  Check, since the credential is behind an access request. Until it lands, the backend runs
  against the verify endpoint with a recorded proof payload and every other layer is unchanged.
- **The Selfie Check flag on the app id**, which is granted separately from sandbox access.

---

# Day 1 — ENS foundation

The ENS track is the one that must not slip, so it goes first.

## Checkpoint 1 — Make the repo build

**Goal.** A clean `forge build` before anything else is written.

**Understand first.** In the ENS tutorial, `REGISTRY` is an immutable of type
`IPermissionedRegistry`, and `IPermissionedRegistry.State` is a struct reached through the
*type*. The current stub renamed the variable to an `address`, so both the type reference
and the variable disappeared. This is a small fix, and it is worth doing by hand because
every later file leans on that type.

**Write.** Fix `src/HeritRegistry.sol:60`. Give the immutable the interface type rather than
`address`, and name it so the `isAvailable` body reads as it does in the tutorial.

**Check.** `forge build` passes and `forge fmt --check` is clean.

**Verified at the stop.** That the fix is the interface type rather than a cast at the call
site.

## Checkpoint 2 — Pin the deployment and register `herit.eth`

**Goal.** Own the parent name every grantor hangs off.

**Understand first.** Two ENSv2 sets exist on Sepolia. The **frozen hackathon set** behind
the banner on docs.ens.domains is the one to use; it does not move for the event. The
regular Sepolia beta set changes as pre-mainnet fixes land.

Registering under `.eth` goes through the public `ETHRegistrar`, which uses commit-reveal:

```
makeCommitment(label, owner, secret, subregistry, resolver, duration, referrer)
  → commit(hash)
  → wait 60s                MIN_COMMITMENT_AGE = 60, MAX_COMMITMENT_AGE = 86400
  → register(label, owner, secret, subregistry, resolver,
             duration, paymentToken, referrer)
```

Verified live: `herit` is available, a year costs `8000021` MockUSDC (6 decimals, so about
8.00), premium is 0, and `MockUSDC.mint(address,uint256)` is open so anyone can mint the
payment. `register` takes a `subregistry` argument, so the grantor registry can be attached
in the same transaction once it exists.

**Do not use the web app.** `manager.ens.dev` and `sepolia.app.ens.domains` register against
the *regular* Sepolia beta set, which is a different group of contracts entirely — beta
`ETHRegistry` is `0xbdc85dd5...` against the hackathon set's `0x1d78834d...`. A name
registered there would be invisible to Herit.

**Run.** `script/RegisterHeritRoot.s.sol`, in three steps because commit-reveal spans a
mandatory 60-second gap that no single broadcast can cover:

```bash
export HERIT_SECRET='any phrase, same for both runs'
forge script script/RegisterHeritRoot.s.sol --sig "commit()" \
  --rpc-url sepolia_eth --account herit-deployer --broadcast
# wait 60 seconds
forge script script/RegisterHeritRoot.s.sol --sig "reveal()" \
  --rpc-url sepolia_eth --account herit-deployer --broadcast
forge script script/RegisterHeritRoot.s.sol --sig "check()" --rpc-url sepolia_eth
```

`commit()` mints the test USDC, approves the registrar and records the commitment.
`reveal()` registers. `check()` is read-only and needs no key.

**Check.** `ETHRegistrar.isAvailable("herit")` returns false afterwards, and
`ETHRegistry.getState(keccak256("herit"))` shows `REGISTERED` with your EOA as owner.

**Verified at the stop.** Owner and expiry on the registered name.

## Checkpoint 3 — Define Herit's own ENS roles

**Goal.** Understand the nybble bitmap well enough to add roles to it.

**Understand first.** Read
`lib/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol` end to end. Roles
pack into a `uint256`: a role at nybble *N* sits at bit `4N`, and its admin counterpart sits
128 bits higher. ENS uses nybbles 0–9 and 30–31. Everything between is available.

**Write.** `src/libraries/HeritRolesLib.sol`, matching the comment style of the ENS library
it sits beside.

```solidity
uint256 internal constant ROLE_HEIR_CLAIM = 1 << 40;              // nybble 10
uint256 internal constant ROLE_HEIR_CLAIM_ADMIN = ROLE_HEIR_CLAIM << 128;
uint256 internal constant ROLE_HEIR_REGISTERED = 1 << 44;         // nybble 11
uint256 internal constant ROLE_HEIR_REGISTERED_ADMIN = ROLE_HEIR_REGISTERED << 128;
```

**Check.** Say out loud why `1 << 40` is nybble 10, and why the admin shift is 128 rather
than 4. If either is fuzzy, the rest of the ENS work becomes guesswork.

**Verified at the stop.** That the chosen nybbles collide with nothing in `RegistryRolesLib`.

## Checkpoint 4 — AccessControlGate

**Goal.** One contract that owns every ENS interaction, so the ENS knowledge stays in one
file. With the issued-name model it has two jobs: onboarding grantors into registry A, and
managing heirs inside each estate's registry B.

**Understand first.** Four things that bite otherwise:

- `_getSettableRoles` returns 0 when `getOwner(resource) == address(0)`, so a role cannot be
  granted on an unregistered or expired subname. Set expiries well past demo day.
- Every grant and revoke burns and re-mints the subname token through `_regenerate`
  (`PermissionedRegistry.sol:528`). Never cache a token id. Address names by labelhash or
  resource.
- `register` takes a `roleBitmap` that becomes the new owner's permissions. Withhold
  `ROLE_HEIR_CLAIM` there; granting it later is the unlock.
- The gate needs `ROLE_REGISTRAR` at root on **both** registries: A to issue grantor names,
  and each B to issue heir names.

**Write.** `src/AccessControlGate.sol`:

*Onboarding, against registry A*
- `openEstate(label, grantor)` — deploy a UserRegistry proxy for this estate through
  `VerifiableFactory.deployProxy(UserRegistryImpl, salt, initData)`, register
  `label` in registry A owned by the grantor with that proxy as its subregistry, and
  record the proxy against the estate id.

*Heirs, against that estate's registry B*
- `registerHeir(estateId, label, heir, relationship, shareBps)` — register the heir subname,
  then write `herit.relationship` and `herit.share` as text records.
- `unlockHeir(estateId, label, heir)` — `grantRoles(labelhash, ROLE_HEIR_CLAIM, heir)`.
- `canClaim(estateId, label, heir)` — reads `hasRoles(...)` back.

**Check.** `forge build --sizes` passes. Watch the size margin, since this contract now
carries proxy deployment as well.

**Verified at the stop.** The registration bitmap, which is where a mistake silently hands
heirs their rights on day one. Also whether this wants splitting into a separate
`HeritRegistrar`, which I will judge once I see the size.

## Checkpoint 5 — Prove the mechanic on-chain

**Goal.** See the ENS role flip on the real registry before building anything on top of it.

**Understand first.** `VerifiableFactory.deployProxy(implementation, salt, initData)` passes
the init call as encoded bytes, so the proxy is created and initialized in one call. The
init grants a bitmap on ROOT_RESOURCE of the new registry. The gate needs the **admin**
halves of the Herit roles there, because settable roles on a name are the root admin bits
shifted down by 128.

The bitmap the gate needs on every registry it controls:

```
RegistryRolesLib.ROLE_REGISTRAR       | ROLE_REGISTRAR_ADMIN
RegistryRolesLib.ROLE_SET_RESOLVER    | ROLE_SET_RESOLVER_ADMIN
RegistryRolesLib.ROLE_SET_SUBREGISTRY | ROLE_SET_SUBREGISTRY_ADMIN
HeritRolesLib.ROLE_HEIR_CLAIM_ADMIN
HeritRolesLib.ROLE_HEIR_REGISTERED_ADMIN
```

Confirm the real `initialize` signature on `UserRegistryImpl` from the verified source on
Sepolia Etherscan before encoding `initData`. A selector scan did not find
`initialize(address,uint256)` and the RPC strips revert data, so this is unconfirmed. See
`documents/deployments.md`.

**Write.** Registry A: deploy a UserRegistry proxy through the factory with the gate as root
account, then `ETHRegistry.setSubregistry(labelhash("herit"), proxyA)`.

**Check.** With `cast`, end to end: open an estate for `alice`, register `son` under it,
read `hasRoles` as false, call `unlockHeir`, read `hasRoles` as true.

**Verified at the stop.** This is the ENS track in one command. If it works, day one
succeeded.

---

# Day 2 — Herit contracts

## Checkpoint 6 — HeritVault

**Goal.** Escrow that cannot be diluted mid-claim.

**Understand first.** If heirs claim at different times and someone deposits between the
two, a share computed from the live balance changes meaning between the first claim and the
second. Snapshot each token balance at unlock and pay from the snapshot.

**Write.** `src/HeritVault.sol` — ETH and ERC20 deposits, balance per token, a snapshot
taken on unlock, and withdrawals restricted to ClaimManager.

**Verified at the stop.** That the snapshot happens on the transition rather than on the
first claim.

## Checkpoint 7 — HeritRegistry

**Goal.** The state machine and the share matrix.

**Write.** Many estates keyed by the grantor's labelhash. Per estate: `lastCheckIn`,
`checkInInterval`, `graceDuration`, `status`, the heir list, and `shareBps[heirLabel][token]`.
Guard the matrix so each token's shares total 10000.

- `checkIn(estateId)` — LivenessAttestor only. Resets the clock, and returns a Grace estate
  to Active.
- `pokeExpiry(estateId)` — open to any caller. Moves Active to Grace to Unlocked, and calls
  `AccessControlGate.unlockHeir` for each heir on the final transition.
- An event on every transition, so the frontend and the video can follow along.

**Check.** Walk the states on paper. What happens if `pokeExpiry` is called twice in one
block, and what happens when both windows have already lapsed and it is called for the first
time.

**Verified at the stop.** The double-transition case, and that the 10000 guard cannot be
bypassed by adding an heir after the fact.

## Checkpoint 8 — ClaimManager

**Goal.** The heir gate, reading its answer from ENS.

**Write.** `claim(estateId, heirLabel)`, callable by LivenessAttestor. Require the estate
Unlocked, `AccessControlGate.canClaim` true, the salted nullifier commitment unused for this
estate, and the heir unpaid for that token. Pay
`snapshot[token] * shareBps[heirLabel][token] / 10000`.

**Verified at the stop.** That the ENS `hasRoles` read is a real gate rather than decoration,
and that the paid flag is per heir per token rather than per heir.

Claude writes alongside this: `script/DeployHerit.s.sol`,
`script/SetupEstate.s.sol`, and the `src/interfaces/` files. All scripts use the
`sepolia_eth` alias rather than a raw URL.

---

# Day 3 — World ID and wiring

## Checkpoint 9 — LivenessAttestor

**Goal.** Accept a backend-signed attestation and nothing else.

**Understand first.** EIP-712 signs *typed structured data* rather than a hash, so a wallet or
a verifier can show what is being signed. Two pieces do the work: a domain separator, which
binds signatures to this contract on this chain, and a type hash for the struct. Get either
wrong and every signature fails to recover. OpenZeppelin's `EIP712` and `ECDSA` supply both —
do not hand-roll the encoding.

**Write.**

```solidity
struct Attestation {
    uint256 estateId;
    address subject;      // the grantor, or the claiming heir
    bytes32 action;       // keccak256("checkin") or keccak256("claim")
    uint256 heirLabelhash; // zero for a check-in
    bytes32 commitment;   // keccak256(worldIdNullifier, salt)
    uint256 nonce;
    uint256 expiry;
}

function checkIn(Attestation calldata a, bytes calldata signature) external;
function claim(Attestation calldata a, bytes calldata signature) external;
```

Four checks, in this order, before either call is forwarded:

1. `ECDSA.recover(_hashTypedDataV4(...), signature) == I_ATTESTOR_SIGNER`.
2. `a.expiry > block.timestamp`, and `a.nonce` unused — then mark it used.
3. `a.action` matches the entrypoint. Without this, a claim attestation is a check-in.
4. `a.commitment`: for a check-in it must equal the commitment bound to this estate, and the
   first check-in is what binds it. For a claim it must be unused for this estate.

Check 4 is the interesting one. The commitment is a salted World ID nullifier, which is stable
per human, so binding it once means a stolen key cannot check in afterwards — the thief is a
different person. It is also the sybil gate on claims.

**Verified at the stop.** That a second check-in whose commitment differs reverts, and that a
claim attestation cannot be replayed into `checkIn`.

## Checkpoint 10 — The verification backend

Claude writes this, so it can be explained at judging. A Next.js route handler in `frontend/`,
not a separate service.

1. `POST /api/verify` receives the IDKit payload plus the estate id and the action.
2. Forwards it as-is to `https://developer.world.org/api/v4/verify/{rp_id}` — "no field
   remapping is required".
3. On a pass, reads `nullifier` from the response and computes
   `keccak256(nullifier, NULLIFIER_SALT)`. The salt never leaves the server: a raw nullifier
   on-chain would link the same human across every estate they touch.
4. Signs the `Attestation` struct with the attestor key and returns it to the frontend, which
   sends the transaction itself.

The signing key is the trust point, and it is worth being straight about that in the video:
narrow, single-purpose, domain-separated to this contract, replay-protected by nonce and
expiry, and holding no funds. What it cannot do is move money — it can only assert that a
Selfie Check passed.

**Verified at the stop.** Explaining back, in your own words, why the nullifier is salted
rather than written raw. That answer is worth points with the World judges.

## Checkpoint 11 — Hand off to the frontend

Give the teammate the ABIs, the deployed addresses and the trigger payload shape. They need
the `selfieCheckLegacy({ signal })` preset from IDKit and an app id with the Selfie Check
flag enabled, which is separate from sandbox app access.

---

# Day 4 — Demo and submission

## Checkpoint 12 — The demo script

Claude writes `script/RunDemo.s.sol`: fund the vault with ETH and the mock token, set
interval and grace to a few minutes, check in once, wait, poke to Grace, poke to Unlocked,
claim as each heir. Run it end to end at least twice before recording.

## Checkpoint 13 — Record and submit

Show the ENS side plainly: `hasRoles` false before unlock and true after, on the real ENS
registry, with the two text records visible on the subname. That single contrast is the ENS
submission.

Then turn the running feedback log into `documents/research/feedback/world.md`, which is
currently empty. It is 25% of the World score and their rubric says not to be nice. Claude
logs every rough edge as it comes up; you write the final version in your own voice.

---

## Fallbacks

| If | Then |
|---|---|
| Sandbox access never arrives | Drive the backend with a recorded Selfie Check payload. Every other layer is unchanged and the video says so plainly. |
| The frozen ENS addresses misbehave | Deploy a `PermissionedRegistry` from the submodule directly and run against that, noting the substitution. |
| Time runs out | One estate, two heirs, ETH plus the mock token. The backend can serve a recorded proof; ENS cannot be faked. |

---

## Verification

Match CI locally before pushing, in this order:

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

End to end on Sepolia:

1. `forge script script/DeployHerit.s.sol --rpc-url sepolia_eth --broadcast`
2. `forge script script/SetupEstate.s.sol --rpc-url sepolia_eth --broadcast`
3. `cast call $USER_REGISTRY "hasRoles(uint256,uint256,address)" $HEIR_RESOURCE $ROLE_HEIR_CLAIM $HEIR` returns false
4. Run a Selfie Check from the frontend, and confirm `CheckedIn` on `HeritRegistry` from a
   transaction carrying a backend-signed attestation
5. Wait out the interval and grace, then
   `cast send $HERIT_REGISTRY "pokeExpiry(uint256)" $ESTATE_ID`
6. Repeat step 3 and confirm it now returns true
7. Claim as each heir and confirm balances match the share matrix

---

## Open items to confirm during the build

- Whether the Selfie Check flag is enabled on the app id, which is separate from sandbox access.
- The exact `selfieCheckLegacy` result shape in the current IDKit, and whether a legacy preset
  needs an `rp_context` signature from the RP signing key. If it does, that is a second key,
  signing proof *requests* rather than attestations.
- Which field of the v4 verify response carries the nullifier for a 3.0 credential.

---

## Reference

| Topic | Link |
|---|---|
| ENSv2 overview | https://docs.ens.domains/ensv2/overview |
| Permissioned registry | https://docs.ens.domains/ensv2/permissioned-registry |
| Permissioned resolver | https://docs.ens.domains/ensv2/permissioned-resolver |
| Enhanced Access Control | https://docs.ens.domains/ensv2/enhanced-access-control |
| Contract developer tutorial | https://docs.ens.domains/ensv2/tutorial-contract-developers |
| World ID docs | https://docs.world.org/ |
| Selfie Check credential | https://docs.world.org/world-id/credentials/11 |
| Testing Selfie Check in sandbox | https://docs.world.org/world-id/sandbox/testing-selfie-check |
| IDKit integration | https://docs.world.org/world-id/idkit/integrate |
| IDKit React presets | https://docs.world.org/world-id/idkit/react |
| On-chain verification (Orb only, optional claim gate) | https://docs.world.org/world-id/idkit/onchain-verification |

Local sources worth reading directly, since they are authoritative and already checked out:

- `lib/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol`
- `lib/contracts-v2/contracts/src/registry/PermissionedRegistry.sol`
- `lib/contracts-v2/contracts/src/registry/UserRegistry.sol`
- `lib/contracts-v2/contracts/src/access-control/EnhancedAccessControl.sol`
