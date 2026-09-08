/**
 * The shapes the screens read.
 *
 * Field names follow the on-chain shapes in `src/AccessControlGate.sol` — labels, basis-point
 * shares, `herit.relationship` records — so wiring real reads in later is a swap of
 * `lib/fixtures/estate.ts` rather than a redesign.
 */

/** Shares are stored in basis points and capped at 10000 across an estate. */
export const BPS_DENOMINATOR = 10_000;

/** The three states in ARCHITECTURE.md §4. */
export type EstateStatus = "active" | "grace" | "unlocked";

export type Heir = {
  /** Subname label inside the estate registry, e.g. "son" → `son.alice.herit.eth`. */
  label: string;
  address: string;
  /** Written to the `herit.relationship` resolver record. */
  relationship: string;
  /** Written to `herit.share`. Capped at 10000 across an estate. */
  shareBps: number;
  claimed: boolean;
};

/** One event herit emits, rendered in the dashboard activity feed. */
export type LogKind = "opened" | "checkin" | "heir" | "unlock" | "claim" | "deposit";

export type LogEntry = {
  id: string;
  stamp: string;
  kind: LogKind;
  text: string;
};

export type Estate = {
  label: string;
  grantor: string;
  estateRegistry: string;
  status: EstateStatus;
  /** Human-readable window copy — the screens display these, nothing computes them. */
  checkInInterval: string;
  graceDuration: string;
  remaining: string;
  /** 0–1, how much of the current window is spent. Drives the countdown ring. */
  progress: number;
  lastCheckIn: string;
  windowCloses: string;
  unlocksAt: string;
  vaultEth: number;
  heirs: Heir[];
  log: LogEntry[];
};

/** An heir paired with its position in the estate, so colours stay stable across filtered lists. */
export type IndexedHeir = {
  heir: Heir;
  index: number;
};
