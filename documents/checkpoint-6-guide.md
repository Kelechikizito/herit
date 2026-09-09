# Checkpoint 6 — HeritVault

Goes with [build-plan.md](build-plan.md) Checkpoint 6. Nothing here touches ENS. After three
checkpoints of other people's contracts, this one is yours end to end: no fork, no frozen
addresses, no submodule surprises. It is the easiest contract in the project and the one
where a quiet mistake costs real money, so the care goes into the accounting, not the code.

Read §9 before you write anything. Two decisions there change what you type.

---

## 1. What the vault is

A grantor puts money in. It sits there while they are alive. When the estate unlocks, each
heir takes their percentage out. That is the whole contract.

One vault holds every estate. Not one vault per estate — that would mean a deployment per
grantor, and there is nothing an estate needs that a mapping key cannot give it.

```
HeritVault
  estate 12345 (alice)   ETH  4.0     MockUSDC 900
  estate 67890 (bob)     ETH  0.5     MockDAI  200
```

Three contracts talk to it, and nobody else:

| Who | Calls | When |
|---|---|---|
| The grantor | `deposit`, `withdraw` | any time before the estate unlocks |
| `HeritRegistry` | `snapshot` | once, on the Active → Unlocked transition |
| `ClaimManager` | `payOut` | once per heir per token, after unlock |

---

## 2. The one idea that matters — two numbers per token

Say alice has 100 ETH in the vault. Son gets 60%, kate gets 40%.

Son claims first and takes 60. Now 40 ETH is left. Kate claims, and 40% of what is left is
**16**. She is owed 40. The percentage moved under her feet, because the number it was a
percentage *of* kept changing.

So the vault keeps two numbers for each token:

| Number | What it is | Changes when |
|---|---|---|
| `balance` | the money actually sitting there | deposit, withdraw, payout |
| `snapshot` | what the balance was at the moment of unlock | never, after unlock |

**The percentage is always taken from the snapshot. The money always comes out of the
balance.** One is a ruler, the other is a wallet. Once you see them as two different jobs the
whole contract falls out:

```
amountOwed = snapshot[estateId][token] * shareBps / 10000
balance[estateId][token] -= amountOwed
```

The build plan's stop question is exactly this: does the snapshot get taken **on the
transition**, or the first time somebody claims? It has to be on the transition. If you take
it on the first claim, and someone deposits between unlock and that first claim, the ruler is
already the wrong length.

---

## 3. What the vault must not do

Every one of these belongs to another contract, and putting it here is the most likely way
this checkpoint goes wrong:

| Not the vault's job | Whose it is |
|---|---|
| Knowing who the heirs are | `AccessControlGate` (registry B) |
| Knowing each heir's share | `HeritRegistry` (Checkpoint 7) |
| Remembering that an heir was already paid | `ClaimManager` (Checkpoint 8) |
| Deciding whether an estate has unlocked | `HeritRegistry` |
| Checking the World ID proof | `LivenessAttestor` |

The vault takes an estate id, a token, a destination and a percentage, and moves money. It
never says the word "heir". Keep it that dumb and Checkpoint 8 is short.

---

## 4. Storage

```solidity
address private constant NATIVE = address(0);          // the key ETH is filed under

mapping(uint256 estateId => mapping(address token => uint256)) private s_balances;
mapping(uint256 estateId => mapping(address token => uint256)) private s_snapshots;
mapping(uint256 estateId => address[]) private s_tokens;      // what to loop over at unlock
mapping(uint256 estateId => mapping(address token => bool)) private s_known;
mapping(uint256 estateId => bool) private s_snapshotTaken;
```

`address(0)` for ETH is a convention, not a rule — but whatever you pick here, `HeritRegistry`
must use the same key in its share matrix, and `ClaimManager` must pass the same value
through. Write it down as a `constant` in one place and import it, rather than typing
`address(0)` in three contracts.

**Why the token list exists.** You cannot loop over a mapping in Solidity. At unlock the vault
has to copy *every* token's balance into the snapshot, so it needs a list of which tokens this
estate holds. Append to it the first time a token is seen; `s_known` is what stops the same
token being appended twice.

**Why the token list is dangerous.** A loop over a list someone else can grow is a way to
brick the unlock: deposit 500 worthless tokens into alice's estate and `snapshot` runs out of
gas, permanently. Two things stop it, and you want both:

- Only the grantor can deposit. Nobody else has a reason to.
- A hard cap anyway — `MAX_TOKENS = 10` or so — so a confused grantor cannot lock their own
  estate. Revert with a named error when the eleventh token arrives.

---

## 5. Never read your own balance

`address(this).balance` and `token.balanceOf(address(this))` are the sum of every estate in
the vault. They are never the answer to "how much does alice have". Read `s_balances`.

This is also why there is no bare `receive()` that credits anything. ETH arrives with no
estate id attached, so there is nothing to credit it to. Either leave `receive` out entirely
so plain sends bounce, or write one that reverts with a message pointing at `depositETH`.
Either way, ETH forced in through `selfdestruct` or a block reward is unaccounted and stays
unaccounted. That is correct — it belongs to no estate.

---

## 6. The five functions

Signatures only. The bodies are yours.

### `depositETH(uint256 estateId) external payable`

Grantor only. Refuse a zero `msg.value`. Refuse if the estate has already unlocked. Register
`NATIVE` in the token list if this is the first ETH in, then add `msg.value` to the balance.

### `depositERC20(uint256 estateId, address token, uint256 amount) external`

Grantor only, same refusals. `SafeERC20.safeTransferFrom` — plain `transferFrom` is wrong
because some tokens return no boolean and the call silently "succeeds" against a `false`.

Credit **what actually arrived**, not what was asked for:

```
before = IERC20(token).balanceOf(address(this));
safeTransferFrom(...);
credited = IERC20(token).balanceOf(address(this)) - before;
```

MockUSDC and MockDAI will not need this. Two lines is cheap insurance against a demo token
that takes a fee on transfer, and it is the kind of thing a judge looks for.

### `withdraw(uint256 estateId, address token, uint256 amount) external`

Grantor only, and **only before unlock**. A will you cannot change is a bad will, and the
grace period exists precisely because the grantor might still be alive and wanting their money
back. Once the estate is Unlocked this must revert — the snapshot has been taken and the money
is spoken for.

Ask `HeritRegistry` for the status rather than keeping your own copy of it. One source of
truth, and it is not this contract.

### `snapshot(uint256 estateId) external`

`HeritRegistry` only. Loop the token list, copy each balance into `s_snapshots`, set
`s_snapshotTaken`.

Make the second call a **no-op, not a revert**. `pokeExpiry` is permissionless and two people
can poke in the same block; a revert deep inside the vault would make the whole transition
fail for the second caller. Returning early is friendlier and just as safe. (Re-running it for
real would be a disaster — after payouts the balances are lower, so the ruler would shrink and
the last heir would be short.)

Emit an event with the estate id. This is the moment the inheritance becomes real, and the
video wants it visible.

### `payOut(uint256 estateId, address token, address to, uint16 shareBps) external`

`ClaimManager` only. Compute from the snapshot, subtract from the balance, then transfer.

In that order — subtract before you send. The heir is an arbitrary address; if it is a
contract, sending ETH hands it control, and it can call back in before your bookkeeping has
caught up. `nonReentrant` from OpenZeppelin as well, the same way `AccessControlGate` uses it.
Belt and braces, and both are one line.

Send ETH with `call{value: amount}("")` and check the return, not `transfer`. `transfer`
forwards 2300 gas, which is not enough for a smart-contract wallet to receive, and plenty of
heirs will be using one.

Return the amount paid. `ClaimManager` wants it for its event.

---

## 7. Three addresses that need each other

`HeritRegistry` and `ClaimManager` do not exist yet, and the vault has to name both. This is
the same knot as Checkpoint 5, and the gate already chose how Herit unties it: **predict the
address with CREATE2 and keep the field `immutable`.** Read the constructor comment at
`src/AccessControlGate.sol:170-190` — the reasoning there applies here word for word, and
`I_HERIT_REGISTRY` is already a predicted address.

The order the deploy script will have to use:

```
1. predict HeritRegistry's address       (salt + init code hash)
2. predict ClaimManager's address
3. deploy AccessControlGate              ← needs 1
4. deploy HeritVault                     ← needs 1 and 2
5. deploy HeritRegistry with CREATE2     ← needs the gate and vault, real
6. deploy ClaimManager with CREATE2      ← needs the registry, vault and gate, real
```

Steps 5 and 6 must land on exactly the predicted addresses or the system is bricked, so
`DeployHerit.s.sol` asserts both before it broadcasts anything. I write that script at
Checkpoint 8 — you just need the constructor to take both addresses and store them
`immutable`.

**If the script fights you on demo day**, the fallback is a one-shot setter: a
`setClaimManager` that reverts if the field is already non-zero. It is weaker — there is a
window where the field is unset — but it is five minutes of work against an hour of debugging
CREATE2 salts at 2am. Do not reach for it first.

---

## 8. Things that will trip you up

**A deposit to an estate that was never opened.** The money would sit in a mapping key nobody
can reach. Read the grantor out of registry A — `getOwner(estateId)` — and revert when it
comes back zero. That one check does two jobs: it proves the estate exists, and it is the
grantor check itself.

**Shares that do not add up to 100%.** `registerHeir` only checks the total stays *at or
under* 10000. An estate with two heirs at 30% each unlocks perfectly happily and leaves 40% of
the money stranded in the vault forever, with `withdraw` already closed. Decide now which you
want:

- refuse to unlock unless the total is exactly 10000 (a check in `HeritRegistry`, Checkpoint 7), or
- accept the residue and add a `sweep` the grantor's estate can never call, which is worse, or
- leave it, and say in the demo that unallocated funds stay locked.

The first is the honest one and it is a single `require` in the contract you write next.

**Rounding dust.** `snapshot * 6000 / 10000` truncates. Three heirs at a third each leave one
or two wei behind. That is fine and every vault has it. Do not write a "last heir sweeps the
remainder" special case — it needs to know who the last heir is, which drags heir knowledge
into a contract that was doing so well without it.

**Deposits after unlock.** Refuse them. The snapshot is already taken, so anything arriving
afterwards is invisible to the percentages and unwithdrawable by anyone. Better to bounce it
at the door.

**The invariant to hold in your head while writing.** After unlock, no deposits and no
withdrawals, so:

```
sum of all payouts for a token  ≤  snapshot[token]  =  balance at unlock
```

Payouts can never drain more than was there. If you ever find yourself needing a check that
the balance did not go negative, something above this line is wrong.

---

## 9. Two decisions to make before you type

**One share per heir, or one share per heir per token?** The build plan's decisions table says
a two-key matrix — `shareBps[heirLabel][token]`. That was decided before the ENS records
existed. `registerHeir` now writes a **single** `herit.share` number per heir, so a per-token
matrix would let the on-chain record and the real share disagree, silently, which the gate's
own NatSpec already warns about.

My recommendation: **one share per heir, applied to every token.** It matches what is already
written into ENS, it is what the video shows, and "son gets 60% of everything" is what a
person setting up a will actually means. If you keep the matrix, the ENS record has to become
a headline number that is documented as approximate.

This decision is yours and it changes `HeritRegistry`, not the vault — `payOut` takes a
`shareBps` either way. Make it now so Checkpoint 7 does not have to be rewritten.

**Should the vault ask `HeritRegistry` for status, or be told?** I have written §6 assuming it
asks. The alternative is that `HeritRegistry` refuses the calls itself and the vault trusts
its callers entirely. Asking costs one external call on a function used twice in the demo, and
it means the vault cannot be tricked by a `ClaimManager` bug. Keep it asking.

---

## 10. Do it in this order

1. Storage, constants, custom errors, events. Nothing else. `forge build`.
2. `depositETH` and `withdraw`, ETH only. This is the whole shape of the contract with none
   of the ERC20 noise — the grantor check, the status check, the token list, the balance.
3. `snapshot` and `payOut`, still ETH only. Now the two-numbers idea is on screen and you can
   see whether it reads right.
4. Add the ERC20 paths. They are the same four functions with `SafeERC20` in the middle.
5. `forge fmt` then `forge build --sizes`.

Steps 2 and 3 are the contract. Step 4 is typing.

**Worth writing a test here, even though the project rule is tests-on-request.** This one is
pure arithmetic with no fork and no ENS, so a `test/unit/HeritVaultTest.t.sol` costs twenty
minutes and covers the case that actually loses money:

- deposit 100, unlock, pay 60%, pay 40%, both heirs get exactly what they should
- the same run with a deposit attempted in between — it reverts, and the second heir is
  unaffected
- `withdraw` works before unlock and reverts after
- `snapshot` called twice changes nothing
- a non-`ClaimManager` caller cannot `payOut`

Say the word and I will write it while you move on to Checkpoint 7.

---

## 11. You are done when

- `forge fmt --check` and `forge build --sizes` are clean, and the four fork tests still pass.
- The vault holds two numbers per token and takes every percentage from the snapshot.
- `snapshot` is callable only by `HeritRegistry`, `payOut` only by `ClaimManager`, and both
  addresses are `immutable`.
- Deposits and withdrawals are grantor-only and both refuse an unlocked estate.
- The word "heir" does not appear anywhere in `src/HeritVault.sol`.
- You can say, without looking, why paying the second heir a percentage of the live balance
  would short-change them. That is the whole checkpoint.
