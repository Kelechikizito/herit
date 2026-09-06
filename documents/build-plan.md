# Herit — four-day guided build

Companion to [ARCHITECTURE.md](../ARCHITECTURE.md). That document says what Herit is; this
one says what gets built, in what order, and who writes each piece.

**Kelechi writes the contracts. Claude explains, reviews and unblocks.** Each checkpoint
states what is being built and why, what to understand before starting, what to write, how
to check it, and what gets verified at the stop. Claude writes only what is not worth the
four days: mocks, deploy scripts, the CRE TypeScript workflow, and the running feedback log.

---

## Progress

- [x] 1 — Make the repo build
- [ ] 2 — Pin the deployment and register `herit.eth`
- [ ] 3 — Define Herit's own ENS roles
- [ ] 4 — AccessControlGate
- [ ] 5 — Prove the mechanic on-chain
- [ ] 6 — HeritVault
- [ ] 7 — HeritRegistry
- [ ] 8 — ClaimManager
- [ ] 9 — LivenessAttestor
- [ ] 10 — The CRE workflow
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

### 2. A Chainlink CRE confidential workflow replaces the backend attestor

`ARCHITECTURE.md` §8 names the attestor signing key as "the biggest centralization point in
the hackathon build". CRE removes it: several DON nodes each call World's Cloud Verify
endpoint and reach consensus before a report reaches Sepolia.

The Chainlink track requires a Chainlink service to make an on-chain state change, which
this satisfies. `LivenessAttestor.sol` becomes a CRE report receiver and accepts nothing
else.

One correction to the original reasoning: the Cloud Verify endpoint takes no API key, so
"the secret stays in the enclave" is not why the workflow is confidential. The two real
reasons are consensus in place of a single key, and keeping the World ID nullifier private.
A nullifier is a stable per-person identifier, and writing it on-chain would link the same
human across every estate they touch.

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
| CRE job | Confidential workflow verifies both check-in and claim, one workflow |
| CRE report | `estateId`, pass flag, and a nullifier hash salted with a vault secret |
| Attestor contract | CRE reports only, no signed fallback and no owner override |
| Unlock reach | Heir subnames only, the grantor's own name is untouched |
| Name model | Herit owns `herit.eth` and issues grantor subnames under it |
| Registration | Grantor onboarding is one free transaction, no commit wait |
| ENS records | `herit.relationship` and `herit.share` on each heir subname |
| Demo assets | ETH plus the deployed `MockUSDC` and `MockDAI`, so no token to deploy |
| Demo clock | Minutes |
| Tests | Only on request |
| If time runs out | Chainlink slips first, ENS and World ship |

---

## Architecture

```
Frontend (teammate)
  └─ IDKit selfieCheckLegacy preset → proof payload
        │ HTTP trigger
        ▼
CRE confidential workflow  (TypeScript, WASM)      ← Claude writes
  ├─ handlerInTee(...)                       runs in an AWS Nitro enclave
  ├─ POST developer.world.org/api/v4/verify/{rp_id}
  ├─ getSecret(NULLIFIER_SALT) → keccak(nullifier, salt)
  ├─ usingTheDons()                          BFT consensus
  └─ evmClient.writeReport(...)              → Sepolia
        │
        ▼
LivenessAttestor.onReport(metadata, report)  ← only the CRE Forwarder
  ├─ kind = checkin → HeritRegistry.checkIn(estateId)
  └─ kind = claim   → ClaimManager.claim(estateId, heirLabel)
        │
HeritRegistry ──unlock──▶ AccessControlGate ──▶ estate UserRegistry B
                                                 grantRoles(heirLabel,
                                                   ROLE_HEIR_CLAIM, heir)
ClaimManager ──hasRoles?──▶ estate UserRegistry B
             ──release────▶ HeritVault
```

---

## Track gates, both outside our control

- **World ID Sandbox** — requested, awaiting a response. Needed for a real Selfie Check.
  Until it lands, the workflow runs against the verify endpoint with a recorded proof
  payload.
- **CRE deploy access** — granted. Simulation runs locally with `cre workflow simulate`;
  deployment is what produces the on-chain state change the prize requires.

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

**Status.** `documents/deployments.md` holds the verified addresses. Registration of
`herit.eth` is the outstanding piece.

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

# Day 3 — CRE and wiring

## Checkpoint 9 — LivenessAttestor

**Goal.** Accept a CRE report and nothing else.

**Understand first.** CRE writes through a Forwarder contract that calls `onReport` on the
consumer. Trust comes from two checks: the caller is the Forwarder, and the workflow owner in
the metadata is ours. The metadata is packed rather than ABI encoded, so confirm the layout
against the CRE receiver docs before writing the decode.

**Write.**

```solidity
function onReport(bytes calldata metadata, bytes calldata report) external {
    require(msg.sender == FORWARDER, NotForwarder());
    (bytes32 workflowId, address workflowOwner, bytes10 workflowName) = _decode(metadata);
    require(workflowOwner == HERIT_WORKFLOW_OWNER, WrongWorkflowOwner());
    (uint8 kind, uint256 estateId, uint256 heirLabel, bytes32 commitment) =
        abi.decode(report, (uint8, uint256, uint256, bytes32));
    ...
}
```

**Verified at the stop.** Both checks are present. Either one alone lets anybody call it.

## Checkpoint 10 — The CRE workflow

Claude writes this and walks through it, so it can be explained at judging.

`cre init --template=hello-confidential-workflows-ts`. Inside `handlerInTee`: read the
trigger payload, POST to `https://developer.world.org/api/v4/verify/{rp_id}` with
`protocol_version` `3.0` (Selfie Check runs on World ID 3.0 and has no 4.0 support), read
`nullifier` from the response, salt it with `getSecret("NULLIFIER_SALT")`, then
`usingTheDons()` and `evmClient.writeReport`. The action string decides the report kind:
`checkin:{estateId}` or `claim:{estateId}:{heirLabel}`.

Run `cre workflow simulate` first — it makes real calls to the live verify API without
needing deployment. Deploy once the report shape is settled, then confirm a real transaction
lands on Sepolia.

**Verified at the stop.** Explaining back, in your own words, why the nullifier is salted
rather than written raw. That answer is worth points with both World and Chainlink judges.

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
| Sandbox access never arrives | Drive the workflow with a recorded proof payload. Every other layer is unchanged and the video says so plainly. |
| CRE deployment fails on demo day | Ship the simulation recording and the deployed receiver contract. The ENS and World halves stand on their own. |
| The frozen ENS addresses misbehave | Deploy a `PermissionedRegistry` from the submodule directly and run against that, noting the substitution. |
| Time runs out | One estate, two heirs, ETH plus the mock token. Chainlink slips before ENS or World. |

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
4. Run a Selfie Check from the frontend, and confirm `CheckedIn` on `HeritRegistry` with the
   transaction sent by the CRE Forwarder rather than by us
5. Wait out the interval and grace, then
   `cast send $HERIT_REGISTRY "pokeExpiry(uint256)" $ESTATE_ID`
6. Repeat step 3 and confirm it now returns true
7. Claim as each heir and confirm balances match the share matrix

---

## Open items to confirm during the build

- The exact CRE `onReport` metadata layout, before writing the decode.
- That Ethereum Sepolia is a CRE write target. The confidential-workflows template
  references Sepolia transactions, and the supported-networks table would not load to
  confirm it directly.
- Whether the Selfie Check flag is enabled on the app id, which is separate from sandbox app
  access.

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
| Selfie Check in IDKit | https://docs.world.org/world-id/idkit/credentials#selfie-check-beta |
| Testing Selfie Check in sandbox | https://docs.world.org/world-id/sandbox/testing-selfie-check |
| Chainlink CRE | https://docs.chain.link/cre |
| Confidential workflows template | https://docs.chain.link/cre-templates/hello-confidential-workflows |
| Template source | https://github.com/smartcontractkit/cre-templates/tree/main/starter-templates/confidential-workflows |

Local sources worth reading directly, since they are authoritative and already checked out:

- `lib/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol`
- `lib/contracts-v2/contracts/src/registry/PermissionedRegistry.sol`
- `lib/contracts-v2/contracts/src/registry/UserRegistry.sol`
- `lib/contracts-v2/contracts/src/access-control/EnhancedAccessControl.sol`
