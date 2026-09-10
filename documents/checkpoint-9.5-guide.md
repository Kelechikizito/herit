# Checkpoint 9.5 — DeployHerit

A build sheet for `script/DeployHerit.s.sol`. It is not in `documents/build-plan.md`, because when
that plan was written the deployment looked like a step at the end of Checkpoint 8 rather than a
piece of work with its own trap in it. It is the trap that earns it a number.

Five contracts exist. None of them has ever been on a chain together, and as written they cannot
be deployed one at a time in any order at all.

---

## 1. The ring

Every dependency between the five is `immutable`, and there is no setter anywhere in `src/`.
That was the right call — a repointable vault is a vault someone can repoint — but it means each
constructor demands an address that does not exist yet:

| Contract | Constructor wants | Already exists? |
|---|---|---|
| `AccessControlGate` | factory, impl, registry A, resolver, **HeritRegistry** | no |
| `HeritRegistry` | registry A, **gate**, **vault**, **attestor** | no, no, no |
| `HeritVault` | registry A, **HeritRegistry**, **ClaimManager** | no, no |
| `ClaimManager` | **HeritRegistry**, **gate**, **vault**, **attestor** | no, no, no, no |
| `LivenessAttestor` | signer, **HeritRegistry**, **ClaimManager** | no, no |

Registry A (`0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21`) and the resolver
(`0x42fA2a1582a89E18d0a54d8dC65157172489EBb1`) are the only two that are already real. Everything
else in that table is waiting on something else in that table.

**CREATE2 does not open this.** A CREATE2 address is `keccak256(deployer, salt, initCodeHash)`,
and the init code carries the constructor arguments. To compute the vault's address you would
need the registry's, whose init code needs the vault's. The comment at `HeritVault.sol:128` says
these are "CREATE2-predicted" and that is the one thing in it that is wrong — leave the code, fix
the comment when you next touch the file.

**Plain `CREATE` does open it,** because a contract address from `CREATE` is only
`keccak256(rlp(deployer, nonce))`. The constructor arguments are not in it. So you can know all
five addresses before writing a single one of them, just by counting how many transactions the
deployer is about to send.

---

## 2. Deploy order

Nonces, not addresses, are the thing you plan. Let `n = vm.getNonce(deployer)` at the top of the
script.

```
n     AccessControlGate   (factory, impl, registryA, resolver, registry@n+1)
n+1   HeritRegistry       (registryA, gate@n, vault@n+2, attestor@n+4)
n+2   HeritVault          (registryA, registry@n+1, claims@n+3)
n+3   ClaimManager        (registry@n+1, gate@n, vault@n+2, attestor@n+4)
n+4   LivenessAttestor    (signer, registry@n+1, claims@n+3)
n+5   registryA.grantRootRoles(GATE_ROOT_ROLE_BITMAP, gate@n)
n+6   resolver.grantRootRoles(GATE_RESOLVER_ROLE_BITMAP, gate@n)
```

Every one of those `@` references is `vm.computeCreateAddress(deployer, nonce)`, computed before
the first broadcast.

**The gate is redeployed, and that is expected.** The gate on Sepolia
(`0xD9431E6811fcd8E6C5D186fF0B2E81024743E947`) has its `I_HERIT_REGISTRY` pointed at your own EOA
— deliberately, so `unlockHeir` was callable by hand for the Checkpoint 5 walkthrough. It is
`immutable`, so a real `HeritRegistry` means a new gate. Registry A, the resolver and `herit.eth`
hold no reference to any gate, so all three survive untouched; only the two root-role grants are
re-run, which is exactly why `DeployRegistryA.deploy()` left those roles on the deployer instead
of revoking them.

---

## 3. The script

`script/DeployHerit.s.sol`, contract `DeployHerit is Script`. `make deploy-herit` is already
written for `--sig "deploy()"`, so match that shape. Update its comment from "Checkpoint 8" while
you are there.

### State variables

The frozen set, as constants, copied from `DeployRegistryA.s.sol` so the two scripts cannot
disagree:

```solidity
IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);
address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;
IPermissionedRegistry internal constant REGISTRY_A = IPermissionedRegistry(0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21);
address internal constant RESOLVER = 0x42fA2a1582a89E18d0a54d8dC65157172489EBb1;
address internal constant FOUNDRY_DEFAULT_SENDER = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;
```

The attestor signer is not a constant. It is the backend's key from Checkpoint 10, it will change
while you build, and hardcoding it means a redeploy every time it does. Read it from the
environment: `vm.envAddress("HERIT_ATTESTOR_SIGNER")`, and let the script fail loudly when it is
unset rather than deploying with a signer nobody holds.

### `deploy()`

Before anything is broadcast:

1. `_deployer()` — the same `--sender` guard the other two scripts use. Copy it. A deployment
   signed by Foundry's public default key is a deployment anyone can rewrite.
2. `require(REGISTRY_A.hasRootRoles(GATE_ROOT_ROLE_BITMAP, deployer))`. Without it, the two grants
   at the end revert after you have already paid for five deployments.
3. Read `n`, compute all five predicted addresses, `console.log` every one.

Then one `vm.startBroadcast()`, the five `new` expressions in the order above, one
`vm.stopBroadcast()`, and after **each** deployment:

```solidity
require(address(gate) == predictedGate, "nonce prediction missed: gate");
```

Five separate `require`s with five different messages, not one combined check. When a prediction
misses you want to know which link broke, because that tells you how many nonces you were off by.

Then the two grants, then log the whole set in one block ready to paste into
`documents/deployments.md`.

### `predict()`

`function predict(address deployer) external view` — print the five addresses without spending
anything, the same courtesy `DeployRegistryA` and `DeployResolver` already offer. Run it first,
every time. It costs nothing and it is the only way to see a nonce problem before it is paid for.

### `check()`

Read-only, takes the five addresses, and asserts the ring actually closed:

```
gate.I_HERIT_REGISTRY()        == registry
registry.I_GATE()              == gate
registry.I_VAULT()             == vault
registry.I_ATTESTOR()          == attestor
vault.I_HERIT_REGISTRY()       == registry
vault.I_CLAIM_MANAGER()        == claims
claims.I_ATTESTOR()            == attestor
attestor.I_HERIT_REGISTRY()    == registry
attestor.I_CLAIM_MANAGER()     == claims
registryA.hasRootRoles(GATE_ROOT_ROLE_BITMAP, gate)
resolver.hasRootRoles(GATE_RESOLVER_ROLE_BITMAP, gate)
```

Eleven reads. Every one of them is a pair of contracts that must agree about each other, and a
deployment where ten pass and one fails is a deployment that looks fine until the demo.

---

## 4. Traps

**Nothing may share the deployer's key while the script runs.** The whole scheme rests on the
deployer sending exactly seven transactions in exactly that order. A pending transaction in the
mempool from another terminal, a wallet doing a background approval, a second `forge script`
running at the same time — any of these shifts every nonce and the `require`s fire mid-way, after
some contracts are already on-chain and wrong. Use a key nothing else touches, and check
`cast nonce $HERIT_OWNER --rpc-url sepolia_eth` matches `predict()`'s assumption before
broadcasting.

**Run it against a fork first.** `--fork-url sepolia_eth` without `--broadcast` executes the whole
thing against real state for free. A bad prediction there costs nothing; on Sepolia it costs five
deployments and an afternoon.

**`alice` is already registered in registry A.** The Checkpoint 5 walkthrough registered it
through the old gate, and `openEstate` reverts `LabelNotAvailable` when the label is not
`AVAILABLE` in registry A. The new gate has no memory of that estate either — `s_estateRegistries`
is its own storage and starts empty. So the first estate on the new gate needs a **fresh label**.
Pick one now and use it consistently through Checkpoints 10 to 13; `alice` is spent.

**The old gate keeps its root roles.** Granting the new gate does not revoke the old one, so two
gates hold authority over registry A and the resolver. For a hackathon that is acceptable and
worth knowing rather than fixing. If a judge asks, the answer is `revokeRootRoles` and the reason
it was not run is that the old gate is the only thing that can still act on the walkthrough estate.

**Deploy `MockUSDC`? No.** `0xcbfd80f74375c54e545af34788ff465f96f66f05` is already on Sepolia and
already in `documents/deployments.md`. Deploying your own adds a sixth nonce to plan around for no
benefit.

---

## 5. Verified at the stop

- `make deploy-herit` runs clean, and `check()` prints eleven passes.
- `forge script ... --sig "predict(address)"` printed the same five addresses that were deployed.
- One estate opens through the **new** gate under a fresh label, and `canClaim` reads false for
  its heirs. That is the same read the Checkpoint 5 walkthrough did, against contracts that now
  hold each other instead of your EOA.
- `documents/deployments.md` has a new table with the five addresses, the transaction hashes, and
  the attestor signer address. Checkpoint 10 and the frontend both read from that table, and an
  address that only exists in terminal scrollback is an address you will retype wrong at 2am.

---

## 6. What this unblocks

`LivenessAttestor` is the only contract that can call `HeritRegistry.checkIn` and
`ClaimManager.claim`. Until it exists at a known address, the backend in Checkpoint 10 has nothing
to sign an EIP-712 domain against — the domain separator binds to a `verifyingContract`, so the
signing code cannot be written, let alone tested, before this checkpoint lands.
