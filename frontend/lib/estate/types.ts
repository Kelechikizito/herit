import type { Address } from "viem";

/**
 * The shapes the screens read, one per thing the chain can be asked about. An estate, its vault
 * and its heirs load separately, so one slow read never holds up the cards that do not need it.
 */

/** Shares are stored in basis points and capped at 10000 across an estate. */
export const BPS_DENOMINATOR = 10_000;

export type EstateStatus = "active" | "grace" | "unlocked";

/**
 * The timers `HeritRegistry.estateOf` returns, in unix seconds. All zero until the estate is
 * configured; `lastCheckIn` stays zero until the first Selfie Check lands.
 */
export type EstateClock = {
  lastCheckIn: number;
  checkInInterval: number;
  graceDuration: number;
};

export type Estate = {
  estateId: bigint;
  label: string;
  /** Registry A's owner of the name. The zero address once the name has lapsed. */
  grantor: Address;
  /** The estate's own ENSv2 registry, where the heir subnames live. */
  estateRegistry: Address;
  /** The pending status: what a poke would store right now, not the cached field. */
  status: EstateStatus;
  clock: EstateClock;
};

/** One asset the vault holds for an estate. */
export type VaultToken = {
  /** `NATIVE_TOKEN` for ETH. */
  token: Address;
  symbol: string;
  decimals: number;
  /** What the estate holds now. */
  balance: bigint;
  /** What it held at unlock, which every share is measured against. Zero before then. */
  snapshot: bigint;
};

export type Vault = {
  /** In the order first deposited. A token withdrawn to zero stays listed. */
  tokens: VaultToken[];
  /** Whether the unlock transition has run and frozen the balances. */
  snapshotTaken: boolean;
};

/** One heir's position in one vault token. */
export type TokenShare = {
  token: Address;
  /** `shareOf`: the per-token override where one was set, the heir's default otherwise. */
  shareBps: number;
  /** `ClaimManager.hasClaimed`. */
  claimed: boolean;
};

export type Heir = {
  label: string;
  labelhash: bigint;
  address: Address;
  /** The `herit.relationship` text record. Undefined while resolving, or if it cannot be read. */
  relationship: string | undefined;
  /** `defaultShareOf`, the estate-wide share the `herit.share` record mirrors. */
  shareBps: number;
  /** Whether ENS grants this heir the claim role. False until someone pokes a lapsed estate. */
  canClaim: boolean;
  /** One entry per vault token, in vault order. */
  holdings: TokenShare[];
};

/** What one heir can take of one token, as `ClaimManager.claimableAll` reports it. */
export type Claimable = {
  token: Address;
  amount: bigint;
};

export type LogKind =
  | "opened"
  | "checkin"
  | "grace"
  | "heir"
  | "unlock"
  | "claim"
  | "deposit"
  | "withdraw";

export type LogEntry = {
  id: string;
  stamp: number;
  kind: LogKind;
  text: string;
  /** Where to look the entry up: its transaction on Etherscan. */
  href?: string;
};

/** An estate the connected wallet opened and still owns the name of. */
export type OwnedEstate = {
  estateId: bigint;
  label: string;
};

/** One row of the estates table: enough to choose between estates, read for all of them at once. */
export type EstateOverview = OwnedEstate & {
  status: EstateStatus;
  clock: EstateClock;
  heirCount: number;
  /** The sum of every heir's `defaultShareOf`. */
  allocatedBps: number;
  /** The vault's ETH balance for this estate. */
  ethBalance: bigint;
  /** ERC20s the vault lists for this estate, whether or not they still hold a balance. */
  erc20Count: number;
};

/** One place the connected wallet is named as an heir: which estate, and which name inside it. */
export type HeirSlot = {
  estateId: bigint;
  estateLabel: string;
  heirLabelhash: bigint;
  heirLabel: string;
};

/** An heir paired with its position in the estate, so colours stay stable across filtered lists. */
export type IndexedHeir = {
  heir: Heir;
  index: number;
};
