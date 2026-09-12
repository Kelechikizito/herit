## one

forge script script/DeployHerit.s.sol --sig "predict(address)" 0x9C0e9298d35E6e357E376E7b07A2342586649418 --rpc-url sepolia_eth --sender 0x9C0e9298d35E6e357E376E7b07A2342586649418
[⠆] Compiling...
No files changed, compilation skipped
Script ran successfully.

== Return ==
d: struct DeployHerit.Deployed Deployed({ gate: 0xA86e42C7250fec7C29cfA09584847B0B24C63103, registry: 0xae63470A513d3488a42cd877b7ec42f861b76207, vault: 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA, claims: 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c, attestor: 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C })

== Logs ==
predicted
gate 0xA86e42C7250fec7C29cfA09584847B0B24C63103
registry 0xae63470A513d3488a42cd877b7ec42f861b76207
vault 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA
claims 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c
attestor 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C

## two

ser@Kaykays-MacBook-Air herit % make deploy-herit
forge script script/DeployHerit.s.sol --sig "deploy()" --rpc-url sepolia_eth --account herit-deployer --sender 0x9C0e9298d35E6e357E376E7b07A2342586649418 --broadcast --verify
[⠒] Compiling...
No files changed, compilation skipped
Script ran successfully.

== Return ==
d: struct DeployHerit.Deployed Deployed({ gate: 0xA86e42C7250fec7C29cfA09584847B0B24C63103, registry: 0xae63470A513d3488a42cd877b7ec42f861b76207, vault: 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA, claims: 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c, attestor: 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C })

== Logs ==
predicted
gate 0xA86e42C7250fec7C29cfA09584847B0B24C63103
registry 0xae63470A513d3488a42cd877b7ec42f861b76207
vault 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA
claims 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c
attestor 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C
signer 0x93cb39747b7390570c5Fa8366F6CD41e4C7940b0
deployed
gate 0xA86e42C7250fec7C29cfA09584847B0B24C63103
registry 0xae63470A513d3488a42cd877b7ec42f861b76207
vault 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA
claims 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c
attestor 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C
next: record these in documents/deployments.md, then run check(address attestor)

## Setting up 1 EVM.

==========================

Chain 11155111

Estimated gas price: 2.725391274 gwei

Estimated total gas used for script: 14856861

Estimated amount required: 0.040490759328430914 ETH

==========================
Enter keystore password:

##### sepolia

✅ [Success] Hash: 0x091ba870b189e85ab312f8ca81cdd49bd1c8c611a1865d751b9a0c353153172c
Block: 11675256
Paid: 0.000082698368049466 ETH (62738 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0xb1b039b8f7303764c3e2026c9223d8c9fa556578d0aea42c27cd24a4298462f0
Contract Address: 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C
Block: 11675256
Paid: 0.002306716080421363 ETH (1749959 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0x9b0f654433f40cda519293ca11db6d3a73122fa89236e68b9ac5ca6c5674453a
Contract Address: 0xae63470A513d3488a42cd877b7ec42f861b76207
Block: 11675256
Paid: 0.003905042827847356 ETH (2962508 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0x029f6c7d5ad9d76e141286f22222b8d4cdf977851c48d5340acc88716955cd75
Contract Address: 0xA86e42C7250fec7C29cfA09584847B0B24C63103
Block: 11675256
Paid: 0.004265575180493497 ETH (3236021 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0xe82ad5a48808e0fc8ded8f6e4e0836c5eb0e744f749168d9ca079319964d3ee5
Contract Address: 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c
Block: 11675256
Paid: 0.00202385465510709 ETH (1535370 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0x1e245e76bbeb485c4eeabd60b84299f0116b36cb66db8ac481321487640aaa6d
Block: 11675256
Paid: 0.000083519578213877 ETH (63361 gas \* 1.318154357 gwei)

##### sepolia

✅ [Success] Hash: 0x5b83791b175ab34981a35053ad3b4879e3e101fa3dbb94170897d5e68cddc47e
Contract Address: 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA
Block: 11675256
Paid: 0.002376153815639409 ETH (1802637 gas \* 1.318154357 gwei)

✅ Sequence #1 on sepolia | Total Paid: 0.015043560505772058 ETH (11412594 gas \* avg 1.318154357 gwei)

## three

user@Kaykays-MacBook-Air herit % make check-herit ATTESTOR=0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C
forge script script/DeployHerit.s.sol --sig "check(address)" 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C --rpc-url sepolia_eth --sender 0x9C0e9298d35E6e357E376E7b07A2342586649418
[⠢] Compiling...
No files changed, compilation skipped
Script ran successfully.

== Logs ==
found
gate 0xA86e42C7250fec7C29cfA09584847B0B24C63103
registry 0xae63470A513d3488a42cd877b7ec42f861b76207
vault 0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA
claims 0xeC3692EA195EecE5370Ea781208cD98d8DBD081c
attestor 0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C
attestor signer 0x93cb39747b7390570c5Fa8366F6CD41e4C7940b0
all checks passed
