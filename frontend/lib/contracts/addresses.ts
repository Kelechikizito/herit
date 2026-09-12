// Every address the app talks to on Sepolia, in one place.
//
// The five Herit contracts hold each other as `immutable` constructor arguments, so they are
// only ever deployed as one set — mixing an address from one deployment with an address from
// another gives a ring whose halves do not recognise each other, and every write reverts. They
// are hardcoded together here for that reason, rather than read from five environment
// variables that can drift apart.
//
// Deployed by `script/DeployHerit.s.sol` and recorded in `documents/deployments.md`.
// After a redeploy: update all five, never one.

import { sepolia } from "viem/chains";

export const CHAIN_ID = sepolia.id;

/** The five Herit contracts. Deployed as one nonce sequence — replace as a set. */
export const herit = {
  /** Opens estates, mints heir subnames, flips ENS roles on unlock. */
  accessControlGate: "0xA86e42C7250fec7C29cfA09584847B0B24C63103",
  /** Estate state machine: timers, heir list, Active/Grace/Unlocked. */
  heritRegistry: "0xae63470A513d3488a42cd877b7ec42f861b76207",
  /** Escrow for the willed ETH and ERC20s. */
  heritVault: "0xC7EBa4BD6CE4c4d42C69e4Da8498911c57dae0BA",
  /** Heir-facing payout entrypoint. */
  claimManager: "0xeC3692EA195EecE5370Ea781208cD98d8DBD081c",
  /**
   * Verifies the backend's EIP-712 Selfie Check attestation, then forwards to the registry or
   * the claim manager. Also the EIP-712 `verifyingContract` the verify route signs for.
   */
  livenessAttestor: "0x6Ffe62994e64c0617f4bdfD2c81C8B439324366C",
} as const satisfies Record<string, `0x${string}`>;

/** The ENS layer. Not part of the five-contract set, so a Herit redeploy leaves these alone. */
export const ens = {
  /** Registry A: one subname per grantor, hanging off `herit.eth`. Deployed at Checkpoint 5. */
  grantorRegistry: "0x0Aa2A7d858bA649B6a794E1fa07ccb97a50E4a21",
  /** Holds every heir's `addr(60)`, `herit.relationship` and `herit.share` records. Deployed at Checkpoint 5. */
  resolver: "0x42fA2a1582a89E18d0a54d8dC65157172489EBb1",
  /**
   * ENSv2's `.eth` registry from the frozen hackathon set, and the parent `herit.eth` itself is
   * registered in. Nothing calls it — it is here so the landing page can link the root of the tree.
   */
  ethRegistry: "0x1d78834d97C1D7b1a38C1DEdbD1a287cFEd3971e",
  /**
   * ENSv2's shared label database, from the frozen hackathon set. Turns a labelhash back into its
   * label — the gate keeps its own label mapping private, so this is how an estate id becomes a name.
   */
  labelStore: "0xD7351F76866123A7E49381F38a30a96AdBa7E855",
} as const satisfies Record<string, `0x${string}`>;

/**
 * Test ERC20s from the frozen ENSv2 hackathon set, for demoing a non-ETH vault deposit.
 * Nothing mints these for you — acquire them before the demo, not during it.
 */
export const tokens = {
  mockUsdc: "0xcBFD80F74375c54E545AF34788Ff465F96F66F05",
  mockDai: "0x93403a98c3A6be906585CD0D68447c0Fc600FB38",
} as const satisfies Record<string, `0x${string}`>;

/**
 * How `HeritVault` labels native ETH in its token list. This is the zero address, not the
 * 0xEeee… sentinel some protocols use — read back off the deployed vault's `NATIVE()`. Pass it
 * to `balanceOf` / `shareOf` when asking about ETH rather than an ERC20.
 */
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000" as const;
