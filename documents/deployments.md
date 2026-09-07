# ENSv2 hackathon deployment — Sepolia

The **frozen hackathon set**, from the banner on docs.ens.domains. Not the regular
Sepolia beta set, which moves as pre-mainnet fixes land.

Chain id `11155111`. Reference by the `sepolia_eth` alias in `foundry.toml`, never a raw URL.

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

### Two open discrepancies

1. `ETHRegistry.supportsInterface(0x6be50c69)` returns **false**, though that is the
   selector in the submodule's `IPermissionedRegistry` docstring. Not a blocker: every
   function we call is present and `getState` decodes into the submodule's `State`
   struct correctly. The docstring selector is likely stale.
2. `initialize(address,uint256)` did not appear in `UserRegistryImpl`'s bytecode by
   selector scan, and the RPC strips revert data so a call probe could not confirm
   either way. Settle this at Checkpoint 5 by reading the verified source on Etherscan
   before encoding `initData`.

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
| Grantor registry (A) | _Checkpoint 5_ |

The owner holds `ROLE_SET_SUBREGISTRY` and its admin, granted by `ETHRegistrar`'s
`REGISTRATION_ROLE_BITMAP` (`ETHRegistrar.sol:18`), which is what lets registry A be attached
at Checkpoint 5.

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
