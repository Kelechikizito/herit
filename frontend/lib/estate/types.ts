/**
 * The shapes the screens read.
 */

/** Shares are stored in basis points and capped at 10000 across an estate. */
export const BPS_DENOMINATOR = 10_000;

export type EstateStatus = "active" | "grace" | "unlocked";

export type Heir = {
  label: string;
  address: string;
  relationship: string;
  /** Written to `herit.share`. Capped at 10000 across an estate. */
  shareBps: number;
  claimed: boolean;
};

export type LogKind = "opened" | "checkin" | "heir" | "unlock" | "claim" | "deposit";

export type LogEntry = {
  id: string;
  stamp: number;
  kind: LogKind;
  text: string;
};

export type EstateClock = {
  lastCheckIn: number;
  checkInInterval: number;
  graceDuration: number;
  storedStatus: EstateStatus;
};

export type Estate = {
  label: string;
  grantor: string;
  estateRegistry: string;
  status: EstateStatus;
  clock: EstateClock;
  vaultEth: number;
  heirs: Heir[];
  log: LogEntry[];
};

/** An estate the connected wallet opened and still owns the name of. */
export type OwnedEstate = {
  estateId: bigint;
  label: string;
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
