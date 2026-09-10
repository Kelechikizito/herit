# Writing `HeritForkTest` — a guide

Companion to [build-plan.md](build-plan.md) Checkpoint 5. You write the test; this explains
what the happy path *is*, what `setUp` has to build before the first assertion can run, and
which of the traps in ENSv2 will bite you while writing it.

---

## 1. What "the happy path" actually means

The phrase is confusing because it sounds like it names a function, and it doesn't. It names
a **story**: the sequence of calls the system performs when nothing goes wrong, from empty
state to the outcome the product exists to produce.

For Herit today that story is six steps, and only two of them are assertions:

```
1. openEstate("alice", alice, expiry)          alice.herit.eth exists, registry B deployed
2. registerHeir(estateId, "son", son, ...)     son exists inside registry B
3. canClaim(estateId, "son", son)  == false    ← the inheritance is DORMANT
4. unlockHeir(estateId, "son", son)            the grantor is presumed gone
5. canClaim(estateId, "son", son)  == true     ← the inheritance is EXERCISABLE
6. (later: ClaimManager releases funds)        not built yet — out of scope for this test
```

Steps 3 and 5 are the test. Everything else is setup for them.

**Why those two lines matter more than they look.** The whole project's claim is that the
heir's right to claim lives inside ENS rather than in a boolean Herit keeps. If that claim is
true, then a role in the real registry must be false before unlock and true after, and
nothing else in Herit needs to change for it. The false→true pair is the proof. If you only
ever write one test in this project, write that one.

**What a happy path is not.** It is not "test every function". It is not reverts, edge cases,
zero addresses, or expiry overflows — those are the *unhappy* paths and they come later, if
at all (`CLAUDE.md`: tests only when asked). If you find yourself writing
`vm.expectRevert`, you have left the happy path.

---

## 2. Why this has to be a fork test

Because the deployed ENSv2 contracts and the pinned submodule are **not the same code**, and
the differences are exactly in the parts Herit touches:

| | Submodule pin `48b3e2d` | Deployed on Sepolia |
|---|---|---|
| `UserRegistry.initialize` | `initialize(address,uint256)` `0xcd6dc687` | `initialize((address,uint256)[])` `0x37cb53a8` |
| `PermissionedResolver.initialize` | `initialize(address,uint256,bytes[])` | `initialize((address,uint256)[],bytes[])` `0x33cc44a0` |
| Resolver record writes | node-based `setAddr(bytes32,…)` | name-based `setAddress(bytes,…)` |

`AccessControlGate` hardcodes `0x37cb53a8`. A local, non-fork test would deploy the
*submodule's* `UserRegistry`, whose initializer has a different selector, so `openEstate`
would revert on its very first call — and you would spend an afternoon debugging a mismatch
that does not exist on the chain you are shipping to.

Fork the chain. `vm.createSelectFork("sepolia_eth")` — you already have this line.

---

## 3. What `setUp` has to build

Five things, in this order. Nothing here is optional; the gate's constructor rejects a zero
address for any of its five dependencies.

**a. The fork.** Done already.

**b. Registry A.** The gate takes it as a constructor argument, so it must exist first.
Replicate what `script/DeployRegistryA.s.sol` does, but inline — see §5 on why you should not
import the script:

- `FACTORY.deployProxy(USER_REGISTRY_IMPL, salt, initData)` where `initData` is
  `abi.encodeCall(IUserRegistryInit.initialize, (roles))` and `roles` is a one-element array
  granting `HeritRolesLib.GATE_ROOT_ROLE_BITMAP` to `address(this)`.
- Pick any salt. The factory namespaces salts by `msg.sender`, and `msg.sender` here is the
  test contract, so nothing you do can collide with the real deployment.

**c. A resolver.** Use `test/utils/MockHeritResolver.sol`. The real deployed resolver does
not expose the functions the gate calls, so `registerHeir` reverts against it — see §6. The
mock keeps that blockage out of the way of the part you are actually testing.

**d. The gate.** Its constructor wants
`(verifiableFactory, userRegistryImpl, grantorRegistry, resolver, heritRegistry, heritNode)`:

- `heritRegistry` — `HeritRegistry` does not exist yet, and for this test it does not need
  to. Pass `makeAddr("heritRegistry")` and `vm.prank` that address when calling `unlockHeir`.
  What the modifier enforces is "exactly one address may unlock", and an EOA proves that as
  well as a contract would.
- `heritNode` — `namehash("herit.eth")` =
  `0x8b9403890eb4d07cc5d239855bdd92cc998195115f2d5d72f886db0b4f9667b3`. Derive it in the test
  rather than pasting it, so the derivation is visible:
  `keccak256(abi.encodePacked(keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))), keccak256("herit")))`.

**e. The gate's root roles on registry A.** This is the step that is easy to forget and whose
absence produces a confusing revert from inside ENS rather than from Herit:

```solidity
IPermissionedRegistry(registryA).grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(gate));
```

The test contract can do this because it initialized registry A holding that bitmap, and
`_getSettableRoles` is `withAdminRolesApplied(effectiveRoles)` — you can grant exactly the
regular roles whose admin halves you hold, plus those admin halves themselves.

**Not needed:** `ETHRegistry.setSubregistry(labelhash("herit"), registryA)`. That call makes
`alice.herit.eth` *resolve* in the outside world, but the gate never reads it — it calls
registry A directly through `I_GRANTOR_REGISTRY`. Skip it here; the deploy script does it for
real. If you want the fidelity, `vm.prank(0x9C0e9298d35E6e357E376E7b07A2342586649418)` (the
`herit.eth` owner) and make the call.

---

## 4. What to assert

Three tests, in increasing order of what they prove.

### `test_happyPath_heirCannotClaimUntilUnlocked`

The one that matters. Open, register, assert `canClaim` is false, unlock, assert it is true.

Assert **false before** and not merely true after. A test that only checks the end state
passes just as happily if the role was granted at registration by mistake — which is the
single most damaging bug this contract could have, because it hands every heir their
inheritance on day one, silently, while the estate looks locked. That is exactly what the
build plan means by "the registration bitmap is where a mistake silently hands heirs their
rights".

### `test_estateRegistryMatchesPrediction`

`gate.predictEstateRegistry(estateId)` before `openEstate`, compared against the address
`openEstate` returns. This guards the frontend: it will show a user their estate address
before they pay for it, and the two derivations are in different places
(`predictEstateRegistry` reimplements the factory's CREATE2 arithmetic by hand). If they
drift, nothing reverts — the UI just lies.

### `test_unlockRegeneratesHeirToken`

Read `registry.getTokenId(labelhash("son"))` before and after `unlockHeir`, and assert the
two differ. This looks like trivia and is not: every grant and revoke burns and re-mints the
subname token through `_regenerate`, so any code that caches a token id breaks the moment an
estate unlocks. Encoding that in a test is what stops someone adding a `heirTokenId` mapping
six months from now.

If you want a fourth: assert `MockHeritResolver.writeCount() == 3` after `registerHeir`
(one `setAddr`, two `setText`). It proves the gate wrote records at all — but see §6 before
believing it means more than that.

---

## 5. What to import — and what not to

```solidity
import {Test, console2} from "forge-std/Test.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {IUserRegistryInit} from "src/interfaces/IUserRegistryInit.sol";

import {MockHeritResolver} from "test/utils/MockHeritResolver.sol";
```

Addresses, from `documents/deployments.md` (frozen hackathon set):

```solidity
IVerifiableFactory constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);
address constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;
```

**Do not import `script/DeployRegistryA.s.sol`.** Two reasons, both of which cost an hour to
discover the hard way. Its `deploy()` guards on `msg.sender` being the owner of `herit.eth`,
and inside a test `msg.sender` is the test contract, so the `require` fails. And it wraps its
calls in `vm.startBroadcast`, which exists to produce transactions for a real chain and only
confuses a test's sender semantics. Scripts and tests need the same two calls; sharing the
code costs more than repeating it.

**Do not import `UserRegistry` from the submodule** to encode `initialize`. That is the whole
reason `src/interfaces/IUserRegistryInit.sol` exists — the submodule's declaration would
type-check against the wrong signature and produce init data the deployed proxy rejects.

**Do not import `HeritRegistry`.** It is a 58-line shell and the test does not need it.

---

## 6. Four things that will bite

**`makeAddr` addresses are not empty on a fork, and this one will cost you an hour.**
`makeAddr("alice")` derives from a publicly-known private key, and on Sepolia those keys have
been used by bots to set **EIP-7702 delegations**. The address really does carry code:

```
$ cast code 0x328809Bc894f92807417D2dAD6b7C998c1aFdac6   # makeAddr("alice")
0xef0100ef7b31f45b19ffef6f1ff5ae684b78b1a86c1c0c          # ef0100… = 7702 designator
```

23 bytes of it. So when `register` mints the ERC-1155 name token to `alice`, the registry
sees `to.code.length > 0`, runs the acceptance check, calls `onERC1155Received` on whatever
that delegation points at, gets nothing back, and reverts — with `EvmError: Revert` and no
reason string, from three delegatecalls deep inside ENS. Nothing in the message suggests your
grantor address is the problem.

Clear the code right after the fork, for every address that will hold a name:

```solidity
vm.etch(alice, "");
vm.etch(son, "");
```

This is fork-specific. The same test on a fresh local chain passes without it, which is
exactly what makes it confusing.

**Your test will fail in CI, and it is not your fault.** `.github/workflows/test.yml` runs
`forge test -vvv` with no `ETH_SEPOLIA_RPC_URL` in the environment, so
`vm.createSelectFork("sepolia_eth")` cannot resolve the alias and every test in the file
errors. Guard `setUp` so the file skips itself instead of failing the build:

```solidity
string memory rpc = vm.envOr("ETH_SEPOLIA_RPC_URL", string(""));
if (bytes(rpc).length == 0) {
    vm.skip(true);
    return;
}
ethSepoliaFork = vm.createSelectFork(rpc);
```

The alternative is adding the RPC URL as a GitHub Actions secret and passing it through the
workflow's `env:`. Either is fine; doing neither turns CI red on the next push.

**A passing resolver assertion currently proves nothing about Sepolia.** `MockHeritResolver`
implements `IHeritResolver`, and `IHeritResolver` is the wrong interface — the deployed
resolver is name-based. So the mock faithfully accepts calls that the real chain rejects.
This is fine as scaffolding, as long as you know that is what it is. Delete the mock when
`_writeHeirRecords` is rewritten, and point the test at a real `PermissionedResolver` proxy.

**Expiries must clear `block.timestamp` on the fork**, which is real Sepolia time, not zero.
Use `uint64(block.timestamp + 365 days)` for the estate and the same or less for the heir —
`registerHeir` reverts with `ExpiryExceedsEstate` if the child outlives the parent, and
`unlockHeir` reverts with `EstateExpired` if the estate has lapsed.

**Fork tests are slow and hit your RPC provider on every run.** Once the test passes, pin a
block with `vm.createSelectFork(rpc, BLOCK_NUMBER)`. Foundry then caches the state locally and
reruns are near-instant, which matters when you run the suite a hundred times on day 2.

---

## 7. Small thing in the file already

The contract is named `HeritForKTest` — capital K. `forge test --mc HeritForkTest` will match
nothing and quietly report zero tests, which is a confusing five minutes. Rename it and the
file together.

---

## 8. The order to write it in

1. `setUp` builds registry A and prints its address with `console2.log`. Run
   `forge test -vvv`. If the address logs, the fork and the array-form `initialize` both work.
2. Add the gate and the role grant. Still no assertions. Run it. If it doesn't revert, the
   five constructor dependencies are wired.
3. Add `openEstate` alone, and assert the returned registry is non-zero.
4. Add `registerHeir`, then the false assertion.
5. Add `unlockHeir`, then the true assertion.

Each step runs green before the next one is written. When something breaks you will know
which line did it, which on a fork test — where a revert can come from three different
contracts you did not write — is worth the extra minutes.

---

## 9. What the finished test should print

This guide was checked by writing the test, running it against Sepolia, and deleting it. The
happy path passes today:

```
[PASS] test_happyPath() (gas: 751521)
  registryA 0xc33aD1C6a44ca75910B4e91C82Df4aEA446ff8eE
  registryB 0xF42B6C6F1680779B6a02cD3F009b43A229eE9F77
  resolver writes 3
  token before 78247…718720
  token after  78247…718721
```

Read that last pair. The heir's token id incremented by exactly one across `unlockHeir` —
that is `_regenerate` burning and re-minting the subname, visible. And `canClaim` returned
false before the unlock and true after, on the real ENSv2 registry on Sepolia.

Which means **the central mechanic of the whole project works**. The role flip that
Checkpoint 5 exists to prove is not a hypothesis any more; it is a passing assertion. What is
left is to write it in your own file, with your own names, so you can explain every line of it
at judging.

Two caveats on that result, both already covered above: the resolver writes went to
`MockHeritResolver`, not the real one (§6), and the estate was opened directly against
registry A rather than through a `herit.eth` that resolves (§3e).
