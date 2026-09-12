---
name: hackathon-readme
description: Write or rewrite the README for a hackathon submission repo by reading the actual codebase, mining deployments and transaction hashes for evidence, and producing a judge-first README. Use this whenever the user mentions writing, drafting, improving, fixing, auditing or "cleaning up" a README, or says their hackathon project needs documentation, or asks what their submission repo should say. Also trigger when the user is preparing a hackathon submission, asks how their repo will look to judges, or shares a README and asks for feedback — even if they never say the word "README". Prefer this over writing documentation from scratch for any repo that is a hackathon entry.
---

# Hackathon README

A hackathon README has one job: convert a skeptical stranger into someone who believes the project is real, novel, and working, in the order they will actually read it.

That stranger is three people at once.

| Reader | Arrives at | Wants | Leaves if |
|---|---|---|---|
| **Judge** | line 1 | to know what this is and why it's new, in 30 seconds | the first paragraph is architecture |
| **Technical reviewer** | line 60 | proof it actually runs, not claims | there are no addresses or tx hashes |
| **Recruiter / future you** | any line | evidence of engineering judgment | everything reads like marketing |

Serve them in that order. A README that opens with a tech-stack table has already lost the judge, and a README with no transaction hashes has already lost the reviewer.

**Quality over quantity.** Target 150–400 lines. Two strong sections beat eight weak ones. Every section must earn its place — if you cannot say what a section proves to one of the three readers, cut it.

---

## Workflow

### Step 1: Read the repo before writing a word

Never draft from the user's verbal description alone. Go find the facts:

```bash
# Orient
ls -la && cat README.md 2>/dev/null | head -60
cat foundry.toml package.json 2>/dev/null
git log --oneline | head -30          # commit count and velocity are evidence
git log -1 --format=%cd               # is this current?

# The contracts
ls -R src/ contracts/ 2>/dev/null
ls test/ && ls script/

# The evidence goldmine — most people forget these exist
cat deployments/*.json deployed.md 2>/dev/null
ls broadcast/ 2>/dev/null             # real deployed addresses AND tx hashes
cat .env.example                      # tells you what services are actually wired up
```

`broadcast/` and `deployments/` are the single highest-value directories in the repo. Foundry writes every deployment there with contract addresses and transaction hashes. Mine them — they turn claims into evidence for free.

Then read the main contracts properly. You cannot write an accurate "How it works" from filenames.

### Step 2: Generate real numbers

Claims you can verify cost nothing and are worth far more than adjectives:

```bash
forge test 2>&1 | tail -20            # real pass counts
forge test --mt invariant 2>&1 | tail -10
forge coverage 2>&1 | tail -20        # only cite if it's good
```

Write "94 tests passing, 3 invariants holding over 3,000 runs" instead of "thoroughly tested". If the numbers are bad, omit the section rather than inflating it.

### Step 3: Find the one defensible claim

Before writing, answer in a single sentence: **what can this project do that no other submission in this hackathon can?**

If the answer is "it uses <sponsor tech>", that isn't a claim, that's a requirement everyone met. Push until you have something falsifiable. Ask the user if it isn't obvious from the code.

This sentence becomes the blockquote under the title, and everything else in the README supports it.

### Step 4: Draft using the structure below

### Step 5: Run the pre-publish audit

Read `references/audit-checklist.md` and run every check. This step is not optional. It catches the class of error that costs real prizes — leaked internal notes, dead links, self-sabotaging framing — none of which are visible while you're writing.

---

## Structure

Use this order. Sections marked **[core]** always appear. Sections marked *[if earned]* appear only when the repo actually supports them — an empty or speculative section is worse than no section.

```markdown
# <Project name>                                          [core]

> <One sentence. What it does and why that was impossible before.>

**<Hackathon name>** · <Track or bounty> · Built on <sponsor tech>

[Live demo](url) · [Demo video](url) · [Deployed contracts](#deployments)

---

## The problem                                            [core]
## How it works                                           [core]
## What makes this different                              [core]
## Architecture                                           [core]
## Deployments                                            [if earned]
## Proof it ran                                           [if earned]
## Quick start                                            [core]
## Testing                                                [if earned]
## Known issues                                           [if earned]
## Track alignment                                        [if hackathon has tracks]
## Tech stack                                             [core]
## What I'd build next                                    [if earned]
## Team · License · Acknowledgements                       [core]
```

### The first 30 lines

This is the whole ballgame. A judge reviewing 90 submissions reads the title block and the problem statement, then decides whether to keep going.

- **Title** — the project name alone. No tagline in the heading.
- **Blockquote** — one sentence, under 30 words, plain language. Name the thing that was impossible before. Not "leverages X to enable Y" — say what happens.
- **Context line** — hackathon, track, sponsor tech. One line, no badges.
- **Link row** — only links that work today. A "coming soon" link is worse than no link; it tells the judge the demo doesn't exist.

### The problem

Three to five lines, concrete, about a person. The strongest version names someone with a specific situation rather than describing a market.

Weak: *"Cross-chain credit is fragmented and lacks interoperability."*
Strong: *"A wallet with three years of Aave repayments posts $1,500 to borrow $1,000 on any other chain. Not because the lender doubts the history, but because it cannot read that chain."*

### How it works

**Lead with a named worked example using real numbers, then show the diagram.** This is the single highest-leverage section and the one most submissions get wrong by opening with an architecture diagram.

```markdown
Ada has $1,000 USDC and wants cash without selling.

1. **She deposits.** $1,000 goes into the Ethereum contract, which parks it in
   Aave at roughly 5% APY.
2. **The deposit is proven.** A permissionless relayer submits a block proof;
   Creditcoin verifies it natively. No oracle, no bridge, no trusted operator.
3. **She borrows $100.** New borrowers start at a 10% limit.
...
7. **The debt hits zero.** Ada never repaid a cent. Her savings did it.
```

Numbers make it checkable. A judge can follow the arithmetic and conclude the mechanism is real. Abstractions can't be checked, so they read as marketing.

Follow with a Mermaid `sequenceDiagram` for the critical path only. One diagram that a judge reads beats five they skip. If the flows genuinely differ by scenario, put the main one here and link the rest to `docs/`.

### What makes this different

One short section, three to five bullets, each naming the alternative it beats. This is where the Step 3 claim gets defended. Be specific about what the alternative does and why it's worse — vague superiority claims read as filler.

### Architecture

Contract-by-contract, one paragraph each, **with permalinks to specific line ranges**:

```markdown
### RiyaEscrow ([src/RiyaEscrow.sol](https://github.com/user/repo/blob/<sha>/src/RiyaEscrow.sol#L45-L78))

Holds depositor USDC and routes it to the Aave adapter. Emits `Harvested` with
the gross yield amount, which is the event the Creditcoin side proves against.
```

Use a full commit SHA in permalinks, not `main` — `main` links rot the moment you push. Get it with `git rev-parse HEAD`.

Include a directory tree only if the repo is a monorepo where layout is non-obvious. For a standard Foundry project, the tree is noise.

### Deployments and Proof it ran

The two sections that separate a real submission from a pretty one. Mine them from `broadcast/` and `deployments/`.

```markdown
## Deployments

### Creditcoin CC3 Testnet
| Contract | Address |
|---|---|
| RiyaASC | [`0xBE67…318E`](https://explorer.../address/0xBE67...) |

## Proof it ran

Full deposit → harvest → debt retirement cycle on testnet:

| Step | Transaction |
|---|---|
| Deposit on Ethereum | [`0x68b8…0a06`](https://sepolia.etherscan.io/tx/0x68b8...) |
| Harvest proven on Creditcoin | [`0x2a99…bfc7`](https://explorer.../tx/0x2a99...) |
| Debt reduced by $25 | [`0x905c…3f8f`](https://explorer.../tx/0x905c...) |
```

**Always label each hash with what it proves and put it in a table.** A bare list of URLs is unreadable — that's the one place the YieldCoin README, which is otherwise excellent on evidence, undersells itself badly.

### Quick start

The shortest path from clone to running. Real commands, real prerequisites, no placeholders like `[your-org]` in the clone URL. If a non-obvious step exists (a symlink, a keystore, a funded wallet), call it out inline with a `>` note — that's the step that makes someone give up.

### Testing

Only with real output. Name the invariants in plain English:

```markdown
- A user must always be able to withdraw their deposit minus fees
- Total shares minted across chains matches parent storage
- TVL is always ≥ net deposits
```

Stating invariants in English shows you thought about what must never break. That reads as engineering maturity more than any coverage percentage.

### Known issues

**Counterintuitively one of the most persuasive sections in the document.** Two or three real limitations, each with the reasoning and the mitigation. It signals you understand your own system's edges, and it defuses the exact question a sharp judge was about to ask.

The bar: a limitation you found and reasoned about, not a feature you didn't build. "No mainnet deployment" is not a known issue. "Burning shares worth less than 0.000001 USDC returns zero because of 6-decimal truncation; mitigated by no-op rather than revert to avoid DoS" is.

### Track alignment

One table mapping the hackathon's stated criteria to where in the repo each is satisfied. Use the organiser's exact wording for the criteria — judges scan for their own language.

| Criterion | How this submission meets it |
|---|---|
| Technical Alignment | Derives yield rate from two attested blocks via precompile `0x0FD2` ([`RiyaASC.sol#L112`](...)) |

Do not use ✅ checkmarks. Self-awarded ticks read as assertion; a pointer to a line number reads as evidence.

### What I'd build next

Three to five items, prose not checkboxes. **Never use an unchecked checkbox list** — it renders as a list of things you didn't finish. If a roadmap item matters, say in one line why it matters and what it unlocks.

---

## Voice

- Plain language over jargon. If a smart non-specialist can't follow the worked example, rewrite it.
- Short declarative sentences. Judges skim.
- Present tense for what exists, explicit future tense for what doesn't. Never blur the two.
- No emoji decoration, no "Built with ❤️" footer, no badge rows.
- Never write "revolutionary", "seamless", "cutting-edge", "leverages", or "game-changing".
- Never compare your project to a well-known one in a way that makes yours sound derivative. "Alchemix proved the model works on one chain; this is the first time collateral and debt live on different chains with no bridge" is honest and strong. "This is a copy of Alchemix" is honest and fatal. Both are true; only one is the right sentence for the first screen.

---

## References

- `references/audit-checklist.md` — the pre-publish audit. Run it every time, including on rewrites.
- `references/section-library.md` — optional sections, when each is worth including, and worked examples of the harder ones.
