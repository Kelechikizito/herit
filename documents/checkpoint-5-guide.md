# Checkpoint 5 — fix the resolver, then deploy for real

Goes with [build-plan.md](build-plan.md) Checkpoint 5. Follows on from
[fork-test-guide.md](fork-test-guide.md), whose §6 warned about the problem this guide fixes.

Your fork test already proves the main idea works: an heir cannot claim, you unlock, now they
can. That part is done. What is left is the part that touches the real chain — and it is more
work than the build plan expected.

---

## 1. The problem in one sentence

The resolver sitting on Sepolia is not the same contract `AccessControlGate` was written to
talk to, so three of the gate's calls would fail on the real chain.

A **resolver** is the contract that stores the actual information attached to a name — the
wallet address it points to, and any text you want to hang off it. Herit uses it to store two
things on each heir: `herit.relationship` (like "son") and `herit.share` (like "6000").

---

## 2. What the real resolver looks like

I read the list of functions straight out of the deployed contract's code. Here is what it
has.

**To write something, every function wants the name spelled out, not hashed:**

| Number that identifies it | Function |
|---|---|
| `b4436dde` | `setAddress(bytes, uint256, bytes)` |
| `c7279f88` | `setText(bytes, string, string)` |
| `eb4b73bb` | `setData(bytes, string, bytes)` |
| `c5d7badd` | `setContenthash(bytes, bytes)` |
| `0ce0112a` | `setName(bytes, string)` |
| `d26f550e` | `setABI(bytes, uint256, bytes)` |
| `9ce8c375` | `setInterface(bytes, bytes4, address)` |
| `e32954eb` | `multicallWithNodeCheck(bytes32, bytes[])` |
| `ac9650d8` | `multicall(bytes[])` |

**To read something back, there is only one function on the whole contract:**

| Number that identifies it | Function |
|---|---|
| `9061b923` | `resolve(bytes, bytes)` |

**These do not exist.** I checked the deployed code for each one and none are there:
`setAddr(bytes32, uint256, bytes)`, `setText(bytes32, string, string)`,
`text(bytes32, string)`, `addr(bytes32, uint256)`, `version(bytes32)`,
`clearRecords(bytes)`, `setAlias(bytes, bytes)`.

**Permissions work normally.** `grantRootRoles`, `grantRoles`, `hasRoles`, `hasRootRoles`
are all there and behave the way you already know from the registry.

So: `src/interfaces/IHeritResolver.sol` describes two functions that do not exist, and
`AccessControlGate._writeHeirRecords` (`src/AccessControlGate.sol:414-417`) calls all three
of them. Your tests pass only because `MockHeritResolver` is a pretend resolver that happily
accepts calls the real one would reject.

---

## 3. The `bytes name` those functions want

Every write function takes the name as `bytes`. That means the name spelled out, with a
number in front of each part saying how long it is, and a zero at the end:

```
son.alice.herit.eth   becomes   \x03son\x05alice\x05herit\x03eth\x00
                                 │  │    │  │     │  │     │  │    │
                                 │  │    │  │     │  │     │  │    end
                                 │  │    │  │     │  │     3  "eth"
                                 │  │    │  │     5  "herit"
                                 │  │    5  "alice"
                                 3  "son"
```

This is called **DNS encoding**. It is just "length, word, length, word, ..., zero".

---

## 4. First problem — you kept the hashes and threw away the words

To build that string you need every part of the name as an actual word. Here is what the gate
has when `registerHeir` runs:

| What it holds | What it actually is | Can you get the word back? |
|---|---|---|
| `label` — `"son"` | text | yes |
| `estateId` — `"alice"` | `keccak256("alice")` | **no** |
| `I_HERIT_NODE` — `herit.eth` | a hash of the whole name | **no** |

Hashing is one-way. Once `"alice"` became a hash, there is no way to get `"alice"` back out
of it. Two of the four parts of the name are gone.

**What to do: save the grantor's label when the estate is opened.**

```solidity
mapping(uint256 estateId => string label) private s_estateLabels;
```

`openEstate` is already handed `label`, so you just save it. It costs gas once, when the
estate is created, and never again. `registerHeir` keeps the same list of arguments, which
matters — that function already has a `{ }` block around part of it at
`src/AccessControlGate.sol:281` to stop the compiler running out of room for variables.
Adding a seventh argument would push it over that limit.

**There is another way, and I did not pick it.** You could pass `grantorLabel` into
`registerHeir` and check it is the right one with
`require(_labelhash(grantorLabel) == estateId)`. That saves no data at all and checks itself,
which is neat. But it needs a spare variable slot you do not have, and the frontend team
would have to change their call. Only do it if paying gas once per estate bothers you more
than that.

You also need `herit.eth` as the spelled-out bytes, not just as a hash. Keep `I_HERIT_NODE`
— unlock still uses it — and add the spelled-out version next to it. It cannot be `immutable`
because its length can vary, so make it a `constant` or set it in the constructor.

---

## 5. Second problem — reading a record is not a simple getter any more

There is no `text(bytes32, string)` to call. To read a record you call `resolve` and hand it
the question you want answered:

```solidity
bytes memory result = resolver.resolve(
    dnsEncodedHeirName,                                              // the spelled-out name
    abi.encodeWithSelector(ITextResolver.text.selector, heirNode, "herit.share")  // the question
);
string memory share = abi.decode(result, (string));
```

Look at the two arguments. The **outer** one is the spelled-out name. The **inner** one still
uses the hash. You need both forms, which is why the gate keeps `_childNode`.

This shows up in two places besides the gate:

- Your fork test, which right now just counts how many times the pretend resolver was called.
  That proves nothing.
- **Checkpoint 13.** The build plan says the ENS submission is "the two text records visible
  on the subname". That is a `resolve` call. Work out a clean one-line version of it now, not
  while you are recording the video.

---

## 6. What to change — four files

### 6a. `src/interfaces/IHeritResolver.sol`

Replace both function descriptions with the ones that really exist, and add `resolve` so you
can read:

```solidity
function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external;
function setText(bytes calldata name, string calldata key, string calldata value) external;
function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
```

In the comments, say which form each argument wants — spelled-out name, or hash. Mixing those
two up is what caused all of this.

### 6b. `src/libraries/HeritRolesLib.sol` — add a second bitmap

The resolver keeps its own separate list of roles, in `PermissionedResolverLib`. They are not
the registry's roles, even though some sit on the same bits. `ROLE_SET_ADDR` is `1 << 0` and
`ROLE_SET_TEXT` is `1 << 4` there. Do not reuse `GATE_ROOT_ROLE_BITMAP` for the resolver — it
is built from registry roles and means something else here. Add:

```solidity
uint256 internal constant GATE_RESOLVER_ROLE_BITMAP =
    PermissionedResolverLib.ROLE_SET_ADDR | PermissionedResolverLib.ROLE_SET_TEXT;
```

**Correction — you do need the `_ADMIN` halves, and I first said you did not.** Leaving them
out builds and deploys fine, then fails at the hand-over step with
`EACCannotGrantRoles(0, 17, ...)`. `EnhancedAccessControl` lets an account grant only the roles
whose admin halves it holds. The deployer starts holding this bitmap and then grants the same
bitmap to the gate, and without the admin halves that second step reverts. So it is:

```solidity
uint256 internal constant GATE_RESOLVER_ROLE_BITMAP = PermissionedResolverLib.ROLE_SET_ADDR
    | PermissionedResolverLib.ROLE_SET_ADDR_ADMIN | PermissionedResolverLib.ROLE_SET_TEXT
    | PermissionedResolverLib.ROLE_SET_TEXT_ADMIN;
```

Same shape as `GATE_ROOT_ROLE_BITMAP`, and for the same reason. The gate never calls
`grantRoles` on the resolver, so the admin bits just sit there unused on its side.

### 6c. `AccessControlGate.sol` — build the name, then use it

You do not have to write the encoder yourself. The ENS code already has it:

```solidity
NameCoder.addLabel(bytes memory name, string memory label)
```

It returns `abi.encodePacked(assertLabelSize(label), label, name)` — the length, then the
word, then whatever was already there. It also refuses empty labels and labels over 255
characters, so you get that checking for free.

Building the heir's name is two of those, stacked onto the parent you saved:

```
parent = "\x05herit\x03eth\x00"
estate = addLabel(parent, s_estateLabels[estateId])   →  \x05alice\x05herit\x03eth\x00
heir   = addLabel(estate, label)                      →  \x03son\x05alice\x05herit\x03eth\x00
```

Then `_writeHeirRecords` makes three calls using the new function names. Later you can turn
those three into one with `multicallWithNodeCheck`, which the real resolver has. That saves
gas and looks better in the demo — but get the three separate calls working first.

### 6d. Delete `MockHeritResolver`

It only existed because you could not call the real resolver. Now you can. In the fork test's
`setUp`, deploy a real resolver the same way you already deploy registry A, and check your
work with `resolve` instead of counting calls.

---

## 7. Deploying — three contracts that each need each other

The registry A guide describes two contracts needing each other's addresses. There are three
now:

```
resolver    needs the gate's address       (to give it roles)
gate        needs the resolver's address   (fixed at construction)
registry A  needs the gate's address       (to give it roles)
gate        needs registry A's address     (fixed at construction)
```

You break this the same way `DeployRegistryA` already breaks it: deploy the two other
contracts with **yourself** holding the roles, deploy the gate once both addresses exist,
then hand the roles over in a second transaction.

1. Deploy the resolver: `VerifiableFactory.deployProxy(PermissionedResolverImpl, salt, initData)`
2. `DeployRegistryA --sig "deploy()"` for registry A
3. Deploy `AccessControlGate`, giving it both addresses
4. `DeployRegistryA --sig "grantGate(address)"` — the registry side
5. `resolver.grantRootRoles(GATE_RESOLVER_ROLE_BITMAP, gate)` — the resolver side. **No script
   does this yet.** Either add it to `DeployRegistryA` or write `DeployResolver.s.sol`.

On every broadcast use
`--account herit-deployer --sender 0x9C0e9298d35E6e357E376E7b07A2342586649418`. As
`documents/deployments.md` explains, `--account` only picks who signs. Leave out `--sender`
and you would hand the top-level roles to Foundry's default test account, whose private key
is published.

---

## 8. Four things that will trip you up

**`NameCoder` has no shortcut path set up.** It lives at
`lib/contracts-v2/contracts/lib/ens-contracts/contracts/utils/NameCoder.sol`, and
`foundry.toml` only has shortcuts for `@ensdomains/contracts-v2/` and
`@ensdomains/verifiable-factory/`. Add this one before you import it:

```
"@ens/contracts/=lib/contracts-v2/contracts/lib/ens-contracts/contracts/",
```

CLAUDE.md's rule about adding the matching `foundry.lock` entry applies here too.

**~~Nobody knows what the resolver's second setup argument is for.~~ Settled.** An empty
`bytes[]` works. A resolver proxy deployed with
`initialize(roles, new bytes[](0))` accepts record writes straight afterwards, proven by
`testHeirRecordsReadBackFromTheRealResolver`. Whatever the argument is for, Herit does not
need it.

**~~Roles given at the top should apply to every name.~~ Settled — they do.** One
`grantRootRoles` on the resolver covers every heir name under every estate. Confirmed on the
fork: the gate writes three records per heir and reads them back, holding nothing but root
roles.

**CI is still broken in your working copy.** You took the skip guard out of the fork test.
That is nothing to do with this checkpoint, but it will go out with it. Put `vm.envOr` back,
or add the RPC URL as a secret in `.github/workflows/test.yml`.

---

## 9. Do it in this order

Get each step working before starting the next. On a fork test, a failure can come from any of
three contracts you did not write, so small steps save you hours.

1. Add the shortcut path. Import `NameCoder` into the gate. Build. Change nothing else.
2. **In the fork test only**, deploy a real resolver and give the test contract the roles.
   Call `setText` on it with a name you typed out by hand. **This is the step that decides
   whether the rest works.** If the roles do not carry down, or the empty `bytes[]` is wrong,
   you find out here in three lines — not after rewriting the gate.
3. Read it back with `resolve`. Now both directions work.
4. Add `s_estateLabels` and the name building to the gate. Rewrite `_writeHeirRecords`.
5. Point the fork test at the real resolver, delete `MockHeritResolver`, and swap the
   call-counting check for a `resolve` that gives back `"6000"`.
6. Only now: deploy for real and do the `cast` walkthrough.

---

## 10. You are done when

- `herit.eth`'s subregistry is registry A, and `FACTORY.verifyContract` agrees it came from
  the right factory.
- The gate holds `GATE_ROOT_ROLE_BITMAP` on registry A, and `GATE_RESOLVER_ROLE_BITMAP` on
  the resolver.
- On the real chain, for a real heir name: `canClaim` is false, you call `unlockHeir`, and
  `canClaim` is true.
- `resolve` gives back `"son"` for `herit.relationship` and the share for `herit.share`.
- In `documents/deployments.md`, the row that says "Grantor registry (A) | _Checkpoint 5_" is
  filled in, with a resolver row next to it.

That list is the ENS submission. Everything later in the build sits on top of it.
