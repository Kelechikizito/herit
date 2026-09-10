# Herit — command reference
#
# Every `forge script` invocation in this project, behind a name you can read.
# `make help` lists them. `make ci` is what GitHub Actions runs.
#
# Two flags appear on every broadcast and both are required:
#   --account  chooses the keystore that SIGNS
#   --sender   sets msg.sender INSIDE the script
# Foundry infers neither from the other. Omit --sender and msg.sender becomes Foundry's
# default account, whose private key is public — which on the deploy scripts would grant the
# registry's and resolver's root roles to a key anyone can spend from. See
# documents/deployments.md.

##@ Configuration

# Override any of these on the command line: make deploy-resolver ACCOUNT=other-key
RPC      ?= sepolia_eth
ACCOUNT  ?= herit-deployer
SENDER   ?= 0x9C0e9298d35E6e357E376E7b07A2342586649418

# Frozen hackathon set, from documents/deployments.md. Constructor arguments for the gate.
FACTORY             := 0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780
USER_REGISTRY_IMPL  := 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546

# Shorthands, so the recipes below stay readable.
BROADCAST := --rpc-url $(RPC) --account $(ACCOUNT) --sender $(SENDER) --broadcast
READONLY  := --rpc-url $(RPC) --sender $(SENDER)

.DEFAULT_GOAL := help

# Fails with a readable message when a required address is missing, instead of sending a
# transaction to the zero address. Used as a prerequisite: `deploy-gate: check-RESOLVER`.
check-%:
	@if [ -z "$($*)" ]; then \
		echo "error: $* is required."; \
		echo "       e.g. make $(MAKECMDGOALS) $*=0x..."; \
		exit 1; \
	fi

##@ Everyday

.PHONY: help
help: ## List every command
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ { printf "\n%s\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_-]+:.*##/ { printf "  %-26s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

.PHONY: install
install: ## Fetch the three git submodules (forge-std, openzeppelin, contracts-v2)
	git submodule update --init --recursive

.PHONY: ci
ci: fmt-check sizes test ## Run the full CI sequence locally, in the order GitHub runs it

.PHONY: fmt
fmt: ## Format every Solidity file
	forge fmt

.PHONY: fmt-check
fmt-check: ## Check formatting without changing anything (fails CI first)
	forge fmt --check

.PHONY: build
build: ## Compile
	forge build

.PHONY: sizes
sizes: ## Compile and print contract sizes against the 24KB limit
	forge build --sizes

.PHONY: test
test: ## Run the test suite
	forge test -vvv

.PHONY: test-fork
test-fork: ## Run only the Sepolia fork tests
	forge test --match-path 'test/unit/HeritForkTest.t.sol' -vvv

.PHONY: clean
clean: ## Delete build artifacts and the fork cache
	forge clean

##@ ENS root — script/RegisterHeritRoot.s.sol

# Registering under .eth is commit-reveal with a mandatory 60-second gap that no single
# broadcast can span, so this is three commands. HERIT_SECRET must be the SAME phrase for
# both commit and reveal; it is what makes the two runs agree.
#
#   export HERIT_SECRET='any phrase'
#   make register-root-commit
#   sleep 60
#   make register-root-reveal
#   make register-root-check

.PHONY: register-root-commit
register-root-commit: check-HERIT_SECRET ## Step 1: mint test USDC, approve, record the commitment
	forge script script/RegisterHeritRoot.s.sol --sig "commit()" $(BROADCAST)

.PHONY: register-root-reveal
register-root-reveal: check-HERIT_SECRET ## Step 2, 60s later: register herit.eth
	forge script script/RegisterHeritRoot.s.sol --sig "reveal()" $(BROADCAST)

.PHONY: register-root-check
register-root-check: ## Read owner and expiry on herit.eth (no key needed)
	forge script script/RegisterHeritRoot.s.sol --sig "check()" $(READONLY)

##@ Checkpoint 5 — deploy the ENS layer

# Order matters. The gate takes registry A and the resolver as immutable constructor
# arguments, so both must exist first; and neither can grant the gate its roles until the
# gate exists. Hence deploy, deploy, deploy, grant, grant:
#
#   make deploy-resolver
#   make deploy-registry-a
#   make deploy-gate REGISTRY_A=0x... RESOLVER=0x... HERIT_REGISTRY=0x...
#   make grant-registry-a GATE=0x...
#   make grant-resolver GATE=0x...
#   make check-checkpoint-5 GATE=0x...
#
# HERIT_REGISTRY: HeritRegistry does not exist yet and every gate field is immutable, so
# whatever you pass is permanent for that deployment. Pass your own EOA — unlockHeir then
# becomes callable by you, which is what the cast walkthrough needs. Checkpoint 8 redeploys
# the gate against the real HeritRegistry; registry A and the resolver survive that, and only
# the two grant targets need re-running.

.PHONY: deploy-resolver
deploy-resolver: ## Deploy the PermissionedResolver that holds heir records
	forge script script/DeployResolver.s.sol --sig "deploy()" $(BROADCAST)

.PHONY: deploy-registry-a
deploy-registry-a: ## Deploy registry A and attach it under herit.eth
	forge script script/DeployRegistryA.s.sol --sig "deploy()" $(BROADCAST)

.PHONY: deploy-gate
deploy-gate: check-REGISTRY_A check-RESOLVER check-HERIT_REGISTRY ## Deploy AccessControlGate (needs REGISTRY_A, RESOLVER, HERIT_REGISTRY)
	forge create src/AccessControlGate.sol:AccessControlGate \
		--rpc-url $(RPC) --account $(ACCOUNT) --broadcast \
		--constructor-args $(FACTORY) $(USER_REGISTRY_IMPL) $(REGISTRY_A) $(RESOLVER) $(HERIT_REGISTRY)

.PHONY: grant-registry-a
grant-registry-a: check-GATE ## Give the gate its root roles on registry A (needs GATE)
	forge script script/DeployRegistryA.s.sol --sig "grantGate(address)" $(GATE) $(BROADCAST)

.PHONY: grant-resolver
grant-resolver: check-GATE ## Give the gate its write roles on the resolver (needs GATE)
	forge script script/DeployResolver.s.sol --sig "grantGate(address)" $(GATE) $(BROADCAST)

##@ Checkpoint 5 — read-only checks

.PHONY: check-registry-a
check-registry-a: ## Registry A: attached, verified, and does the gate hold its roles
	forge script script/DeployRegistryA.s.sol --sig "check(address)" $(or $(GATE),0x0000000000000000000000000000000000000000) $(READONLY)

.PHONY: check-resolver
check-resolver: ## Resolver: deployed, verified, and can the gate write records
	forge script script/DeployResolver.s.sol --sig "check(address)" $(or $(GATE),0x0000000000000000000000000000000000000000) $(READONLY)

.PHONY: check-checkpoint-5
check-checkpoint-5: register-root-check check-registry-a check-resolver ## All three read-only checks in one go

.PHONY: predict-registry-a
predict-registry-a: ## The address deploy-registry-a will produce, before spending anything
	forge script script/DeployRegistryA.s.sol --sig "predict(address)" $(SENDER) $(READONLY)

.PHONY: predict-resolver
predict-resolver: ## The address deploy-resolver will produce, before spending anything
	forge script script/DeployResolver.s.sol --sig "predict(address)" $(SENDER) $(READONLY)

##@ Checkpoint 9.5 — deploy the five Herit contracts

# All five hold each other as immutable constructor arguments, so they go out as one nonce
# sequence and cannot be deployed separately. Predict, dry-run, deploy, check:
#
#   make predict-herit
#   make deploy-herit-dry
#   make deploy-herit
#   make check-herit ATTESTOR=0x...
#
# Nothing else may spend a nonce on ACCOUNT while deploy-herit runs — a stray transaction
# shifts every predicted address and the script aborts part-way through.
#
# HERIT_ATTESTOR_SIGNER: the backend's attestor address from Checkpoint 10. It is immutable
# on LivenessAttestor once deployed, so a wrong one means redeploying all five. Export it,
# or override on the command line: make deploy-herit HERIT_ATTESTOR_SIGNER=0x...
export HERIT_ATTESTOR_SIGNER

.PHONY: predict-herit
predict-herit: ## The five addresses deploy-herit will produce, before spending anything
	forge script script/DeployHerit.s.sol --sig "predict(address)" $(SENDER) $(READONLY)

.PHONY: deploy-herit-dry
deploy-herit-dry: ## Run the whole deployment against a fork, free, before paying for it
	forge script script/DeployHerit.s.sol --sig "deploy()" --fork-url $(RPC) --sender $(SENDER)

.PHONY: deploy-herit
deploy-herit: ## Deploy gate, registry, vault, claim manager, attestor, and re-grant the ENS roles
	forge script script/DeployHerit.s.sol --sig "deploy()" $(BROADCAST)

.PHONY: check-herit
check-herit: check-ATTESTOR ## Walk the whole ring and assert every pair agrees (needs ATTESTOR)
	forge script script/DeployHerit.s.sol --sig "check(address)" $(ATTESTOR) $(READONLY)

##@ Not written yet — targets land with their scripts

# Kept here so the command shape is decided once, in one place, rather than rediscovered on
# the day. Each target fails with a pointer until its script exists.

.PHONY: setup-estate
setup-estate: ## Checkpoint 9.6: open one estate and register its heirs
	@test -f script/SetupEstate.s.sol || { echo "script/SetupEstate.s.sol does not exist yet (Checkpoint 9.6)"; exit 1; }
	forge script script/SetupEstate.s.sol --sig "run()" $(BROADCAST)

.PHONY: run-demo
run-demo: ## Checkpoint 12: fund, check in, poke to Grace, poke to Unlocked, claim
	@test -f script/RunDemo.s.sol || { echo "script/RunDemo.s.sol does not exist yet (Checkpoint 12)"; exit 1; }
	forge script script/RunDemo.s.sol --sig "run()" $(BROADCAST)

##@ Frontend — run from frontend/, never the repo root

.PHONY: fe-install
fe-install: ## Install frontend dependencies
	cd frontend && npm install

.PHONY: fe-dev
fe-dev: ## Start the Next.js dev server
	cd frontend && npm run dev

.PHONY: fe-build
fe-build: ## Production build
	cd frontend && npm run build

.PHONY: fe-lint
fe-lint: ## Lint (bare eslint, not next lint)
	cd frontend && npm run lint
