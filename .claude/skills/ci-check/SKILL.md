---
name: ci-check
description: Run the full CI sequence locally before pushing — forge fmt --check, forge build --sizes, forge test -vvv, plus the frontend lint. Use when the user asks to verify changes, check CI parity, or before committing Solidity or frontend work.
---

Reproduce what `.github/workflows/test.yml` does, in the same order, so failures surface locally instead of on GitHub.

## Steps

Run from the repo root. Do not stop at the first failure — run all four, then report every result together.

1. `forge fmt --check`
   Formatting is CI's first step, so an unformatted file fails the run before anything compiles. If this fails, run `forge fmt` to fix it and say so.

2. `forge build --sizes`
   Report any contract approaching the 24576-byte EIP-170 limit, not just hard failures.

3. `forge test -vvv`
   Report failing test names and the assertion that failed, not just the summary count.

4. `cd frontend && npm run lint`
   Skip only if nothing under `frontend/` changed — say that you skipped it and why.

## Reporting

Give a per-step pass/fail table, then the details of anything that failed. If everything passes, say so in one line — don't pad it.

If a step fails for an environmental reason rather than a code reason (missing submodule, unset `ETH_SEPOLIA_RPC_URL`, `node_modules` absent), name the cause and the fix instead of reporting it as a code failure.
