# ENSv2 hackathon deployment — Sepolia

The **frozen hackathon set**, from the banner on docs.ens.domains. Not the regular
Sepolia beta set, which moves as pre-mainnet fixes land.

Chain id `11155111`. Reference by the `sepolia_eth` alias in `foundry.toml`, never a raw URL.

## Herit's names do not appear in the ENS app

**This is expected, and not a sign that registration failed.** The official ENS app indexes the
regular Sepolia **beta** set. Herit registers into the **frozen hackathon** set, which is a
different group of contracts entirely. A name registered in one is invisible to the other, so
looking up `herit.eth` or any `<grantor>.herit.eth` on the ENS website returns nothing no matter
how correct the registration was.

The chain is the source of truth. To confirm a name really exists, read the registry directly:

```bash
make register-root-check       # herit.eth: status, owner, expiry — no key needed
```

`status 2` is `REGISTERED`. The same applies to grantor and heir subnames: read them through
registry A and the estate registry, never through the ENS app.

## The ones Herit uses

| Contract | Address | Role in Herit |
|---|---|---|
| `ETHRegistry` | `0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e` | The `.eth` PermissionedRegistry. Parent of the grantor name. |
| `VerifiableFactory` | `0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780` | Deploys the per-estate UserRegistry proxy. |
| `UserRegistryImpl` | `0x47b442d0cf617c41cabaff5f02f44dd1e5f72546` | Implementation the proxy points at. |
| `PermissionedResolverImpl` | `0xa9d3814ab151bf6e37a427432795371a8361614e` | Resolver implementation for the heir text records. |
| `LabelStore` | `0xd7351f76866123a7e49381f38a30a96adba7e855` | Shared label database the registry constructor takes. |
| `UpgradableUniversalResolverProxy` | `0xd26f2040d083af1cd2962ba303f4bea0c4faf142` | Override viem/ethers' built-in Universal Resolver with this. |
| `MockUSDC` | `0xcbfd80f74375c54e545af34788ff465f96f66f05` | Usable as the demo ERC20 instead of deploying our own. |
| `MockDAI` | `0x93403a98c3a6be906585cd0d68447c0fc600fb38` | Second test token if the share matrix needs one. |

## Verified on-chain

Checked with `cast` against Sepolia at planning time:

- All four core addresses have code.
- `ETHRegistry` supports ERC165 and ERC1155.
- Every function Herit calls is present on `ETHRegistry`: `getState`, `getStatus`,
  `getResource`, `getTokenId`, `getOwner`, `latestOwnerOf`, `register`, `renew`,
  `setSubregistry`, `setResolver`, `getSubregistry`, `grantRoles`, `revokeRoles`,
  `hasRoles`, `grantRootRoles`, `roles`.
- `VerifiableFactory` exposes `deployProxy(address,uint256,bytes)`, so the
  `initialize` call is passed as encoded `initData` rather than called directly.

### The submodule is behind the deployment

`lib/contracts-v2` is pinned at `48b3e2d`, and the hackathon contracts were built from something
newer. Deployed `UserRegistryImpl` runtime is 35,506 hex chars against the submodule's 31,518, and
it carries functions the pin does not have (`findOwner`, `findExpiry`, `findTokenId`, `getParent`,
`setLabel`, `getURI`, `isContractNamer`).

**One signature actually differs, and it is the one we need:**

| | Signature | Selector |
|---|---|---|
| Submodule pin | `initialize(address,uint256)` | `0xcd6dc687` |
| **Deployed** | `initialize((address,uint256)[])` | `0x37cb53a8` |

The deployed initializer takes an **array of `(account, roleBitmap)` pairs**, so root roles can go
to several accounts at deploy time. Do not import `UserRegistry` from the submodule to initialize
a proxy — declare a minimal local interface instead:

```solidity
interface IUserRegistryInit {
    struct RoleAssignment { address account; uint256 roleBitmap; }
    function initialize(RoleAssignment[] calldata assignments) external;
}
```

Encoded for the gate, this is what goes into `deployProxy`'s `data` argument:

```
VerifiableFactory.deployProxy(UserRegistryImpl, salt, initData)   // 0x5d84121a
initData = abi.encodeCall(IUserRegistryInit.initialize,
                          ([RoleAssignment(gate, GATE_ROOT_ROLE_BITMAP)]))
```

**Everything else matches.** These were checked selector-by-selector against the deployed bytecode
and are identical to the submodule, so the submodule interfaces are safe for all of them:

`register` `renew` `unregister` `getState` `getStatus` `getResource` `getTokenId` `getOwner`
`latestOwnerOf` `setSubregistry` `setResolver` `getSubregistry` `getResolver` `grantRoles`
`revokeRoles` `grantRootRoles` `revokeRootRoles` `hasRoles` `hasRootRoles` `roles` `roleCount`

Also resolved: `ETHRegistry.supportsInterface(0x6be50c69)` returns false because the deployed
interface differs from the pinned one, so its selector differs too. Not a problem — never check
against that constant.

## Full deployment table

| Contract | Address |
|---|---|
| `BatchRegistrar` | `0xc8efa80d9f645b26bacd1bae8638492df3bae8ca` |
| `ContractNamer` | `0x21a2b577709727119f1901314e0ba0150eafa15e` |
| `DefaultReverseRegistrarAdapter` | `0x0a8d7ed4061548fb3cb192d0cbe9e1a57b3b1ae9` |
| `DNSAliasResolver` | `0x005a3bf1d92ebe4b1e1641a0c6fa49f38e1762a6` |
| `DNSSECGatewayProvider` | `0xfedb5c2fea17cef8547d534c3125f7601d3e30bd` |
| `DNSTLDResolver` | `0x10107255fda20ab6c37a0efca1e9465f25066a00` |
| `DNSTXTResolver` | `0x0ebc944ac29f91cc24ee507a2d46aa4901bbc748` |
| `ENSV1Resolver` | `0x1f11e5b8bca2ccfe13bd8431853db159c4e9849c` |
| `ENSV2Resolver` | `0xb1b2d8c4d4886d0d567b6a6b8a4b885229fafae4` |
| `ETHRegistrar` | `0x7d1b7f586a62ac3f54b9a396849757814283270b` |
| `ETHRegistry` | `0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e` |
| `ETHRenewerV1` | `0x47bc0ab8f87db01383255e564cce92956ecc7c70` |
| `Graveyard` | `0x2c29661b216717650ba6d4836b2bd37a0fe19adb` |
| `HCAOwnerAndSessionValidator` | `0xeb099163a41912a94e56b2143feb6eb7979a51f0` |
| `HCAUpgradeSet` | `0xde59f9285edbe391fc32d3cba8909ea047cc0fc3` |
| `LabelStore` | `0xd7351f76866123a7e49381f38a30a96adba7e855` |
| `LockedMigrationController` | `0x7fa65c83dd80cca2fbd91e16a6dc4f66b64efe22` |
| `ManagedUniversalResolverProxy` | `0x1abed09f1f36383f27cf0b3a5e0ea1738e1fd921` |
| `MigrationHelper` | `0x540f222a6fd9a54e77989556f366940d1ad81aec` |
| `MockDAI` | `0x93403a98c3a6be906585cd0d68447c0fc600fb38` |
| `MockRegistrationIntentExecutor` | `0x9675de20abf0216d07e3f5782dd92d0c7d3bb2cb` |
| `MockUSDC` | `0xcbfd80f74375c54e545af34788ff465f96f66f05` |
| `PermissionedResolverImpl` | `0xa9d3814ab151bf6e37a427432795371a8361614e` |
| `PublicResolverSet` | `0x3866e84b54a78d1e3778421e0fbf3607fa9c402f` |
| `PublicResolverV2` | `0xf9de4979ddb290baf5b760d0e788125017bc33f6` |
| `RegistryUpgradeSet` | `0x658c43979721b6d30d173ea09622f2475761b382` |
| `ReverseRegistrarAdapter` | `0x67ee68067c74cb3ab595fb793860f98c8a0283f7` |
| `RootBatchRegistrar` | `0x9b30da91c1a3fb972d5a7d102390598d5ca70376` |
| `RootRegistry` | `0xe7f0d5724f8337e3aa9a9910540341ff4273fed9` |
| `StandaloneHCAFactory` | `0xb85152a8ef4db5caf37af6bffce66b559a9c0b58` |
| `StandaloneHCAImplementation` | `0x7328a1926b45f0339913ab654fb98d1a0f5ec894` |
| `StandardRentPriceOracle` | `0xfeba6589b5c1b35875c0389ccedf83148b6ee71b` |
| `TestnetV1PremigrationRegistrar` | `0x1a8c627dc167bcf6b991e9d6e0a76e2dfab7ee88` |
| `UniversalHelper` | `0x1d4cd7545d456f3b6a7e4380182279afcfa887b6` |
| `UniversalResolverV2` | `0xfea8d4b7fcce0b8765c793d6695eac384aaa458f` |
| `UnlockedMigrationController` | `0x97494264ad5437611cc2f43987c21f6f352d786a` |
| `UpgradableUniversalResolverProxy` | `0xd26f2040d083af1cd2962ba303f4bea0c4faf142` |
| `UserRegistryImpl` | `0x47b442d0cf617c41cabaff5f02f44dd1e5f72546` |
| `VerifiableFactory` | `0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780` |
| `WrapperRegistryImpl` | `0x7c53b9dcef516662e9e8a229448cac30b90673cd` |

## Note from the ENS team

For name resolution against this deployment, the Universal Resolver address built into
viem and ethers must be overwritten once in your code with
`UpgradableUniversalResolverProxy` above. Relevant to the frontend, not the contracts.

## Herit root

`herit.eth` is the parent every grantor name hangs off. Registered once, by us; grantors get
`alice.herit.eth` free.

| Item | Value |
|---|---|
| Name | `herit.eth` |
| Owner | `0x9C0e9298d35E6e357E376E7b07A2342586649418` (keystore `herit-deployer`) |
| Expiry | `1820278872` — 2027-09-07, a year out |
| EAC resource | `68075676060768908916428320288337324792951252921863322193669617456339144933376` |
| Registered by | `script/RegisterHeritRoot.s.sol` |
| Grantor registry (A) | `0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21` |

The owner holds `ROLE_SET_SUBREGISTRY` and its admin, granted by `ETHRegistrar`'s
`REGISTRATION_ROLE_BITMAP` (`ETHRegistrar.sol:18`), which is what lets registry A be attached
at Checkpoint 5.

## Herit contracts

Deployed at Checkpoint 5. Registry A and the resolver are permanent; the gate is redeployed at
Checkpoint 8 against the real `HeritRegistry`, and only the two role grants need re-running.

| Contract | Address | Notes |
|---|---|---|
| Grantor registry (A) | `0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21` | `UserRegistry` proxy, attached as `herit.eth`'s subregistry. Holds one name per grantor. |
| `PermissionedResolver` | `0x42fA2a1582a89E18d0a54d8dC65157172489EBb1` | Proxy carrying every heir's `addr`, `herit.relationship` and `herit.share` records. |
| `AccessControlGate` | `0xD9431E6811fcd8E6C5D186fF0B2E81024743E947` | Holds `GATE_ROOT_ROLE_BITMAP` on registry A and `GATE_RESOLVER_ROLE_BITMAP` on the resolver. |

Both proxies come from `VerifiableFactory` `0x894bc9cC…7780`, so `verifyContract` confirms their
provenance. The gate's `I_HERIT_REGISTRY` is the deployer EOA for now, which is what makes
`unlockHeir` callable by hand for the walkthrough.

| Step | Transaction |
|---|---|
| Registry A deployed and attached | `script/DeployRegistryA.s.sol --sig "deploy()"` |
| Resolver deployed | `script/DeployResolver.s.sol --sig "deploy()"` |
| Gate deployed | `0x4e9b1e6d6ad412729f315d420c17560ff5482ec0d19576b528185db68f50e5f1` |
| Gate granted registry A roles | `0x67fe7e62a453eebb439916b89b15b4a33a5337ea85b4da903017cb7b1425e58c` |
| Gate granted resolver roles | `0xbb0d318f76f99311574d680fa10fefff870b8fc6193ffbc5c4d16326e8134929` |

`make check-checkpoint-5 GATE=0xD9431E68…E947` re-runs all three read-only checks.

### Checkpoint 9.5 — the five Herit contracts

Deployed as one nonce sequence by `script/DeployHerit.s.sol`. All five hold each other as
`immutable` constructor arguments, so they are only ever replaced as a set — pairing an address
here with one from an earlier deployment gives a ring whose halves do not recognise each other.

All verified on Sepolia Etherscan.

| Contract | Address | Transaction |
|---|---|---|
| `AccessControlGate` | `0xA86e42C7250fec7C29cfA09584847B0B24C63103` | `0x029f6c7d5ad9d76e141286f22222b8d4cdf977851c48d5340acc88716955cd75` |
| `HeritRegistry` | `0xae63470A513d3488a42cd877b7ec42f861b76207` | `0x9b0f654433f40cda519293ca11db6d3a73122fa89236e68b9ac5ca6c5674453a` |
| `HeritVault` | `0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA` | `0x5b83791b175ab34981a35053ad3b4879e3e101fa3dbb94170897d5e68cddc47e` |
| `ClaimManager` | `0xeC3692EA195EecE5370Ea781208cD98d8DBD081c` | `0xe82ad5a48808e0fc8ded8f6e4e0836c5eb0e744f749168d9ca079319964d3ee5` |
| `LivenessAttestor` | `0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C` | `0xb1b039b8f7303764c3e2026c9223d8c9fa556578d0aea42c27cd24a4298462f0` |

| Step | Transaction |
|---|---|
| Gate granted registry A roles | `0x1e245e76bbeb485c4eeabd60b84299f0116b36cb66db8ac481321487640aaa6d` |
| Gate granted resolver roles | `0x091ba870b189e85ab312f8ca81cdd49bd1c8c611a1865d751b9a0c353153172c` |

All seven landed in block 11675256. The hashes are taken from the on-chain receipts
(`contractAddress` for the five creations, `to` for the two grants). The `transactions` array in
`broadcast/DeployHerit.s.sol/11155111/deploy-latest.json` pairs hashes with the wrong entries;
its `receipts` array is correct, so read hashes from there, not from `transactions`.

This gate supersedes Checkpoint 5's `0xD9431E68…E947`, which pointed `I_HERIT_REGISTRY` at the
deployer EOA. Registry A and the resolver are unchanged; the deploy re-ran their two role grants
against the new gate.

`LivenessAttestor.I_SIGNER` is `0x93cb39747b7390570c5Fa8366F6CD41e4C7940b0`, the backend's
attestor EOA. It is `immutable` — rotating that key means redeploying all five.

`make check-herit ATTESTOR=0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C` walks the ring and
asserts every pair agrees. Passing as of this deployment.

The frontend's copy of these addresses lives in `frontend/lib/contracts/addresses.ts`, and its
ABIs are generated from `out/` by `npm run abi`. Both need updating on any redeploy.

### The Checkpoint 5 walkthrough, on-chain

One estate opened by hand through the gate, to prove the mechanic before anything was built on
it. `estateId` is `keccak256("alice")` = `0x9c025711…0501`.

| Item | Value |
|---|---|
| Estate registry (B) | `0x5C2c554E5718f0a605C79bF2Cd3d965D5e66eFa1` |
| `son.alice.herit.eth` | `0xDBC29E79b2B3b62C015AB598D0bb86681313d90F`, 6000 bps |
| `daughter.alice.herit.eth` | `0x93923B42Ff4bDF533634Ea71bF626c90286D27A0`, 4000 bps |

`canClaim` read false after `registerHeir` and true after `unlockHeir`, for both heirs, and the
resolver returns `herit.relationship`, `herit.share` and `addr(60)` for each name. Reading a
record takes `resolve(dnsEncodedName, abi.encodeCall(text, (node, key)))` — the outer argument is
the name spelled out, the inner one is the namehash.


Address the name by its **resource** above, never by token id. Token ids change on every role
grant or revoke (`PermissionedRegistry._regenerate`).

### Running a script against this deployment

`--account` chooses the signer. `--sender` sets `msg.sender`. Foundry infers neither from the
other, and omitting `--sender` silently substitutes Foundry's default account, whose private
key is public.

```bash
export HERIT_SECRET='...'
export HERIT_OWNER=0x9C0e9298d35E6e357E376E7b07A2342586649418
forge script <script> --rpc-url sepolia_eth --account herit-deployer --sender $HERIT_OWNER --broadcast
```
