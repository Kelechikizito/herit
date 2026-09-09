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
  /** Unix seconds — the block timestamp of the emitting event. Formatted at render. */
  stamp: number;
  kind: LogKind;
  text: string;
};

/**
 * The `Estate` struct, exactly as `HeritRegistry.estateOf` returns it.
 *
 * Seconds, not milliseconds, and unix rather than a Date — these are `uint64`s read straight off
 * the chain, so the only conversion at the read boundary is `Number(...)` on the bigint. The
 * screens format these; they never reason from them about what state the estate is in.
 */
export type EstateClock = {
  /** Unix seconds of the last accepted Selfie Check. Zero means the clock never started. */
  lastCheckIn: number;
  /** Seconds the grantor has to check in. Zero means the estate is not configured. */
  checkInInterval: number;
  /** Seconds of grace after a missed check-in, before heirs unlock. */
  graceDuration: number;
  /**
   * The stored `status` field, which is a cache: it only moves when someone calls
   * `pokeExpiry()`. Compare it against `statusOf` — the live answer — to know whether a poke
   * would change anything. Neither value is ever computed here.
   */
  storedStatus: EstateStatus;
};

export type Estate = {
  label: string;
  grantor: string;
  estateRegistry: string;
  /**
   * From `HeritRegistry.statusOf` — the live status every other contract trusts, including
   * `HeritVault`. Read, never derived: the frontend has no opinion about when an estate lapses.
   */
  status: EstateStatus;
  /** From `HeritRegistry.estateOf`. Formatted into a countdown, nothing more. */
  clock: EstateClock;
  vaultEth: number;
  heirs: Heir[];
  log: LogEntry[];
};

/** An heir paired with its position in the estate, so colours stay stable across filtered lists. */
export type IndexedHeir = {
  heir: Heir;
  index: number;
};
