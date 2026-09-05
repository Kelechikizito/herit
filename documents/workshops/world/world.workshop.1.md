# Proof of Human — World Workshop

> **Speaker:** Mateo — Tools for Humanity (TFH), the team building World
> **Host:** Pascal, ETHGlobal
> **Length:** ~28 min (22 min talk + 6 min Q&A)
> **Focus:** World ID, Selfie Check (beta), AgentKit, and the two prize tracks

---

## ⚡ Act on these first

Three things in this talk are gated behind a request form or a whitelist. Start them now, not on day three.

| What                     | Why you need it                                                                                                                                  | How                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **World ID Sandbox app** | AgentKit requires an **Orb-verified** credential. This is an online hackathon — you cannot reach a physical Orb. The sandbox is the only way in. | Create an account in the **Developer Portal** → "request sandbox access" button → form also linked from the World prizes page and posted in Discord |
| **Sybil score access**   | Ships publicly "next week"; Mateo will whitelist hackers early on request                                                                        | Ask him on Discord                                                                                                                                  |
| **Selfie Check beta**    | Still in beta; attendees were given access as a courtesy of the beta team                                                                        | Comes with the above                                                                                                                                |

Sandbox access is distributed via **TestFlight** and **Firebase App Distribution**, so it needs your email address.

---

## TL;DR

- World is **the real human network** — 39M users across 160+ countries, co-founded by Sam Altman and Alex Blania.
- **World ID** proves you're a human online without revealing _who_ you are. ZK proofs, generated on-device, never raw data.
- Three assurance levels: **Orb** (highest) → **Official ID / NFC passport** (high) → **Selfie Check** (medium, new, lowest friction).
- **Selfie Check** also returns a **Sybil score** — a signal for how many times the same face has tried to enter your platform.
- **AgentKit** lets you delegate your World ID to your agents, so an agent can prove it's _human-backed_. One command to set up.
- Two tracks, **$3,500 each**, three winners each. **Written feedback is 25% of your score** — the single highest-weighted judging line after strategic fit.

---

## 1. The Problem

_(1:13 – 2:30)_

Mateo's own "aha" moment came from Peter Steinberger — creator of Clawdbot — on the Lex Fridman podcast:

> ### _"I watched my agent happily click the 'I'm not a robot' button."_

That's the whole thesis in one sentence. The trust layer of the internet is broken:

- **Over 50%** of internet traffic is now bots
- Deepfake incidents against organizations spiked over the past year
- The **Arup CFO deepfake scam** cost the firm **$25 million**

What's missing is an **AI-proof way to distinguish a real person from a bot** in digital interactions.

---

## 2. What World ID Is

_(2:30 – 4:14)_

A **high-assurance authentication layer for bot protection**, built as a privacy-preserving protocol.

The distinction that matters: it knows **nothing about you as a person** — only that you _are_ a person.

**Architecture:** zero-knowledge proofs with cryptographic proof generation happening **on-device**, never on raw data. A World ID proof says only: _there is a human holding this device, performing this interaction._

**What you'd use it for as a developer:** a trust layer that stops bot abuse in your app, via credentials like proof of human, document verification, or Selfie Check.

---

## 3. The Three Verification Methods

_(4:19 – 7:09)_

| Method           | Assurance  | How it works                                                                                                                                     | Friction         |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| **Orb**          | 🟢 Highest | Physically visit an Orb — a camera with a large sensor array — which images your **iris** and generates a proof                                  | High (in person) |
| **Official ID**  | 🟡 High    | NFC chip in your ID card or passport. **~13 countries** supported and expanding. A trusted government attests that a citizen holds this document | Medium           |
| **Selfie Check** | 🟠 Medium  | Uses your phone's camera to establish humanness/liveness. New — TFH's own take on the liveness checks neobanks and fintechs use                  | 🟢 Lowest        |

### On the Orb and your iris image

> The Orb **immediately deletes the image** after generating the proof.
>
> Don't take that on faith — the firmware is public at **`worldcoin/orb-firmware`** on GitHub, and you can verify the Orb's firmware at the moment you get verified.

### Orb vs. Selfie Check

Selfie Check images your **whole face** rather than your iris. It is explicitly **not as reliable** as an Orb proof — that's the trade being made. What you buy is speed and near-zero friction.

---

## 4. Selfie Check, In Depth

_(9:02 – 11:01)_

The **low-friction on-ramp to World ID**. A very quick selfie confirms a real, live person is behind the device. No Orb trip required.

### The Sybil score

Selfie Check returns more than a yes/no. It also returns a **Sybil score**.

Mateo's deliberately non-technical framing:

> The Sybil score represents **how many times this same face has tried to enter your platform.**
>
> If someone runs Selfie Check a million times across different devices, their Sybil score climbs. A high score means that person has been trying to break your platform's uniqueness guarantee by creating multiple accounts.

So: humanness _and_ a uniqueness signal, in one call.

**Availability:** Sybil score goes live next week. Ask for early whitelist access if you want to build on it now.

---

## 5. AgentKit

_(11:01 – 13:12)_

**The human layer for agentic automation.**

The mental model:

```
World ID  ───────▶  proves YOU are a human online
    │
    │ delegate
    ▼
Your Agent ──────▶  acts on your behalf, carrying that verified World ID
```

This is **human-verified autonomy**. It unlocks a new primitive for the agentic economy: you can finally distinguish an **army of unverified bots** from an agent **backed by a real, verified human**.

### Setup

Literally one command. It links your agent's wallet to your World ID with secure authorized access, and writes the agent's address into an **address book** — the on-chain registry of all human-backed agents.

> **You can delegate one World ID to many agents.** Mateo has his own delegated across three or four agents running different workflows for him.

### Use cases shown

| Use case               | Shape                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Onchain delegation** | Agent acts onchain under your verified identity                                                                                     |
| **Agentic commerce**   | Shopify or any e-commerce — offer special pricing or access to human-backed agents                                                  |
| **Human in the loop**  | An integration built with **Vercel**: in a Vercel workflow, require a human to prove presence before the agent takes a given action |

### The Shopify demo

TFH ran a Shopify integration giving away **500 hats available only to verified humans and human-backed agents**. (You still paid for the hat — verification just gated who could claim one.)

The whole integration: add the plugin → install the AgentKit Shopify integration → tell your agent _"help me purchase this item."_ It works because the agent is verified human-backed. Written up in the docs.

---

## 6. The World ID Sandbox App

_(13:12 – 15:12)_

**The problem:** AgentKit only accepts **Orb-verified** credentials. This hackathon is online. You can't get to an Orb.

**The solution:** the World ID Sandbox app — the World App in sandbox mode.

| Property     | Detail                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| Environment  | Staging — mirrors everything in production                                      |
| Uniqueness   | ❌ Not real. It's a non-production app                                          |
| Identifier   | ✅ Creates your identifier                                                      |
| Credentials  | ✅ Unlocks every World ID / Orb-verified feature **without actually verifying** |
| Listing      | Not publicly listed yet — hackathon attendees get beta access                   |
| Distribution | TestFlight + Firebase App Distribution (email required)                         |

> Mateo flagged a second audience for this beyond hackathons: people who are **skeptical about getting verified but genuinely want to try the product.** Feedback on the sandbox is explicitly wanted.

**If you're building on the AgentKit track, you're expected to use the sandbox app.**

---

## 7. Patterns Worth Building

_(15:12 – 16:51, 18:52 – 20:29)_

Mateo was upfront that these are prompts, not answers — _"I'm not going to give you a solution because I don't have it either."_

### For AgentKit

- **New verticals for human-backed agents** — differentiated access tiers or pricing on a platform, purely because the agent has a human behind it
- **Agentic workflows combining identity and payments** in a shape we haven't seen yet
- **Human-backed agents for regulated workflows** — one human behind many agents, changing the product logic
- **Agent-to-agent or agent-to-API trust flows**

### For Selfie Check

| Pattern              | How it works                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Research funnels** | Gate certain information so only real users reach it                                                                                                    |
| **Risk-based flows** | Selfie Check unlocks low-risk features immediately; full verification unlocks high-risk actions. Avoids a heavy onboarding that loses users at the door |
| **Free trials**      | Already in use by startups today. You learn _"there's a human here"_ without learning **who** — enough to grant the trial, nothing more                 |

> The core value: _"I don't know who he is. I don't need to know who he is."_

---

## 8. What Won't Qualify

_(17:49 – 18:52)_

Mateo kept this short on purpose — he'd rather you build freely and ask in Discord if unsure. But these have been seen too often:

- ❌ **Static demos** with no end-to-end AgentKit integration
- ❌ **Simple agent reputation** — many submissions already
- ❌ **Commerce demos that only apply a discount to an agent** — TFH already built exactly this (the hat drop). Skip it.

> If in doubt whether your idea is too obvious, **just ask in the Discord channel.**

---

## 9. Tracks & Requirements

_(7:09 – 9:02, 20:29 – 21:17)_

Two tracks. **$3,500 each. Three winners per track.**

### Track 1 — AgentKit: New Use Cases _(continuity track)_

For teams **already building something** who integrate AgentKit in a way that meaningfully benefits their existing project.

- [ ] Use AgentKit in a **meaningful** way
- [ ] **Verify the agent is human-backed before granting access** to whatever you're building
- [ ] Working **end-to-end** flow
- [ ] A **new vertical** beyond the obvious examples
- [ ] Written **dev + user feedback**, ideally as a document

### Track 2 — Selfie Check _(beta)_

TFH is actively hunting for integrators who will tell them what's broken.

- [ ] Use Selfie Check in a **meaningful** way
- [ ] Cover **both dev and user feedback** in detail, ideally as a document
- [ ] Working **end-to-end**
- [ ] A **new vertical** beyond the obvious examples
- [ ] **V3 or V4 proofs** both accepted — V4 lands next week

---

## 10. Judging Rubric

_(21:17 – 22:20)_

| Weight  | Criterion                            | What they're looking for                                              |
| ------- | ------------------------------------ | --------------------------------------------------------------------- |
| **30%** | Strategic fit & useful trust surface | Is this integration meaningful to World and its products?             |
| **25%** | **Feedback quality**                 | _"Don't be nice."_ Tell them what's bad, what's good, what you'd want |
| **20%** | Product quality                      | —                                                                     |
| **15%** | Technical integration                | Correct integration with **IDKit** or **AgentKit**                    |
| **10%** | Deployment / feedback path           | Can this outlive the hackathon? Will you keep building it?            |

> **A quarter of your score is the feedback document.** Both products are pre-GA and TFH is optimizing for signal. Harsh, specific, well-organized criticism is worth more here than polish.

---

## 11. Q&A

_(22:36 – 27:23)_

**Q: Can Selfie Check match against an already-taken selfie?**

Close to what it already does. Selfie Check compares an **on-device image you already have** against the selfie captured live during the check.

---

**Q: Can Selfie Check back an AgentKit agent-book registration?**

**No.** AgentKit is **Orb-verified only** — which is precisely why the **sandbox app** exists for this online hackathon.

---

**Q: What's the difference between "Selfie Check legacy" and "proof of human"? Do both qualify?**

A naming problem TFH acknowledges needs fixing:

| Label                   | Actually means |
| ----------------------- | -------------- |
| **Selfie Check legacy** | Selfie Check   |
| **Proof of human**      | Orb verified   |

Both are credentials under the **same SDK — IDKit**.

> **For the track:** you must include **Selfie Check**. Building on both Selfie Check _and_ proof of human is perfect — but Selfie Check has to be in there.

---

**Q: Does Selfie Check support [retention] indefinitely?**

No — capped at **90 days**.

---

**Q: How do we submit our email for sandbox access?**

Create an account in the **Developer Portal** → find the button requesting sandbox access → the form is also linked from the **World prizes page** (bottom, under Resources) and was posted in the Discord channel.

---

## 12. Links & Support

| Resource                          | Where                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Documentation                     | **docs.world.org** (also behind the QR code on the closing slide)                                              |
| Sandbox access form               | World prizes page → Resources section, and in Discord                                                          |
| Support                           | The **Discord channel** — TFH devs are available throughout                                                    |
| Mateo                             | Discord: **`Mr. Saon`** — _"because my last name is Saon and it was a very obvious thing to do when I was 18"_ |
| Orb firmware (verify it yourself) | `worldcoin/orb-firmware` on GitHub                                                                             |

**Getting started checklist:**

- [ ] Create a Developer Portal account
- [ ] Request sandbox access via the form (needed for anything AgentKit)
- [ ] Ask Mateo on Discord for early **Sybil score** whitelisting if you want it
- [ ] Pick your track — AgentKit (continuity) or Selfie Check
- [ ] **Start the feedback document on day one**, not the night before submission — it's 25% of the score
- [ ] Check your idea against the "won't qualify" list, or ask in Discord

---

## Transcription Notes

Cleaned from an auto-generated transcript. Speech-to-text corrections applied throughout: _civil score_ → **Sybil score**, _world lady ID_ → **World ID**, _Verscell / Verser_ → **Vercel**, _B3 proofs_ → **V3 proofs**, _ID kit_ → **IDKit**, _lightness_ → **liveness**, _dogs.world.org_ → **docs.world.org**, _Alex Fritman_ → **Lex Fridman**, _Sam Alman_ → **Sam Altman**, _Arab CFO_ → the **Arup** deepfake case, _Cloudbot_ → **Clawdbot**, _warcoin/orb firmware_ → **`worldcoin/orb-firmware`**.

Three items worth verifying against source material:

- The speaker said **"Spotify integration"** once, then described a **Shopify** integration for the rest of the segment. Recorded as Shopify.
- The rubric's stated weights (25 / 20 / 15 / 10) sum to 70%. The **30% for strategic fit** is inferred as the remainder — confirm before optimizing against it.
- **Mateo's surname** and Discord handle are transcribed as spoken ("Saon") and may be spelled differently.
