# Pre-publish audit

Run every check before the README ships. These catch errors that are invisible while writing because they're artifacts of the writing process itself.

Report findings to the user as a short list. Fix the mechanical ones directly; flag the judgment calls.

## 1. Leaked internal content

The highest-severity failure mode and the easiest to miss. Drafting notes, AI-assistant advice, and self-directed reminders get pasted into a README and published.

```bash
grep -niE "you should|make sure to|don't forget|remember to|note to self|before a judge|hoping nobody|say it out loud|TODO|FIXME|XXX|\[your-|placeholder|lorem ipsum" README.md
```

Also read the whole file once asking one question per paragraph: *is this addressed to the reader, or to the author?* Anything in the second category is cut. A published README containing "say this out loud in the pitch rather than hoping nobody notices" tells a judge they're reading your private prep.

## 2. Empty and orphaned sections

```bash
grep -n "^#" README.md    # then check each heading has content under it
```

A heading with nothing under it reads as abandoned work. Either fill it or delete it. Same for a table of contents linking to sections that no longer exist.

## 3. Dead and speculative links

```bash
grep -noE "\[([^]]*)\]\(([^)]*)\)" README.md
```

Flag every one of these:
- `(#)` or `(url)` or any empty target
- "coming soon", "TBD", "link pending"
- `main`-branch permalinks (they rot on the next push — replace with a commit SHA)
- placeholder org or repo names in clone commands

A demo link that doesn't work is worse than no demo link. It converts "no demo yet" into "they linked something broken."

## 4. Self-sabotage

Read the first 30 lines as an adversarial judge looking for a reason to stop. Flag:
- Any sentence describing the project as a copy, clone, fork, or port of something well known
- Staleness warnings ("this README is out of date", "docs pending")
- Apologies, hedges, or disclaimers about unfinished work placed above the fold
- Honest limitations that belong in Known Issues but landed in the opening

Honesty is not the problem; placement is. Limitations belong in Known Issues, where they read as rigor. In the opening they read as a warning label.

## 5. Claims without evidence

Every factual claim should be checkable:

| Claim type | Needs |
|---|---|
| "deployed on X" | address + explorer link |
| "it works end to end" | labelled transaction hashes |
| "well tested" | real pass count from `forge test` |
| "verified" | verification link, not the word |
| "uses <sponsor tech>" | permalink to the line where it's called |

Any claim you cannot back with one of these, cut it or soften it to what you can prove.

## 6. Reader-order check

Read only lines 1–30 and answer:
1. What does this do?
2. Why couldn't it be done before?
3. Is it working right now?

If any answer isn't there, restructure before shipping. Nothing below line 30 fixes a weak opening, because most judges never reach line 30.

## 7. Length and density

```bash
wc -l README.md
```

Over 400 lines: find what to move to `docs/`. Candidates in order — deployment runbooks, per-scenario diagram galleries, API type dumps, operational notes for one hosting provider.

Then check density: any section over 15 lines that contains no number, link, address, or code is probably prose that should be three bullets.

## 8. Checkbox and emoji sweep

```bash
grep -nE "^\s*-\s*\[ \]|✅|🚀|🎉|❤️|🔥" README.md
```

Unchecked boxes advertise incompleteness. Self-awarded ✅ against judging criteria reads as assertion where a line-number pointer would read as evidence. Emoji decoration costs credibility with technical judges and gains nothing.

## 9. Final read-aloud

Read the blockquote pitch out loud. If you stumble, it's too long or too abstract. Under 30 words, plain language, one idea.
