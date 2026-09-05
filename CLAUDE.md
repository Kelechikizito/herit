# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Herit — next-of-kin inheritance gated by proof of life. ETHOnline hackathon, targeting the World and ENS tracks. Grantors register heirs as ENSv2 subnames, prove liveness with World ID Selfie Check, and heirs gain Enhanced Access Control rights if a check-in window lapses.

Design, contract responsibilities, and hackathon scope: @ARCHITECTURE.md

## Two build surfaces

- **Repo root** is a Foundry project (`src/`, `test/`, `script/`, `lib/`).
- **`frontend/`** is a separate Next.js app with its own `CLAUDE.md` → `AGENTS.md`. Run `npm` commands from inside `frontend/`, never the root.

Next.js here is **16.3.4** — newer than most training data. Before writing frontend code, read the relevant guide in `frontend/node_modules/next/dist/docs/`, as `frontend/AGENTS.md` instructs.

## Commands

CI (`.github/workflows/test.yml`) runs these three in order; match them locally before pushing:

```bash
forge fmt --check      # fails CI first — formatting is not optional
forge build --sizes
forge test -vvv
```

Frontend: `npm run lint` (bare `eslint`, not `next lint`), `npm run dev`, `npm run build` — all from `frontend/`.

## Submodules

`lib/` holds three git submodules: `forge-std`, `openzeppelin-contracts`, and `ensdomains/contracts-v2` (ENSv2). Clone with `--recursive`; CI checks out with `submodules: recursive`.

`contracts-v2` has **no remapping in `foundry.toml` and no `foundry.lock` entry** — add both before importing from it.

## Environment

`.env` (gitignored) supplies the RPC URLs consumed by `foundry.toml`:

- `ETH_SEPOLIA_RPC_URL` → alias `sepolia_eth`
- `WORLDCHAIN_SEPOLIA_RPC_URL` → alias `worldchain_sepolia`

Reference networks by alias (`forge script ... --rpc-url sepolia_eth`), not by raw URL.

## Gotchas

- **`docs/` is gitignored** (Foundry's `forge doc` output default). Project documentation goes in `documents/`, or it will silently never be committed.
- **ENSv2 targets the frozen hackathon Sepolia deployment**, not the regular Sepolia beta set. The regular set may change as pre-mainnet fixes land. Addresses are behind the banner on docs.ens.domains; workshop notes are in `documents/workshops/ens/`.
- `FOUNDRY_PROFILE=ci` is set in CI, but `foundry.toml` defines no `[profile.ci]` — CI silently uses `[profile.default]`. Adding a `ci` profile will change CI behavior.
- `src/interfaces/`, `test/unit/`, `test/fuzz/`, and `test/utils/` are empty and indicate the intended layout for new files.

## Conventions

- Commit directly to `main`; no feature branches or PRs during the hackathon.
- Write tests only when asked — the demo path takes priority.
- `Counter.sol` / `Counter.t.sol` / `Counter.s.sol` are Foundry template scaffolding. Leave them in place.
