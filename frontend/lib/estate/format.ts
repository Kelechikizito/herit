import { type Address, formatUnits, isAddressEqual } from "viem";
import {
  BPS_DENOMINATOR,
  type EstateClock,
  type EstateStatus,
  type Heir,
  type IndexedHeir,
  type TokenShare,
  type Vault,
  type VaultToken,
} from "./types";

/** Formatting and derivation over an estate. Pure, no rendering, no fixtures. */

/** The client-side sum of every heir's `defaultShareOf`. There is no getter, and none is needed. */
export function allocatedBps(heirs: readonly Heir[]): number {
  return heirs.reduce((total, heir) => total + heir.shareBps, 0);
}

export function unallocatedBps(heirs: readonly Heir[]): number {
  return Math.max(0, BPS_DENOMINATOR - allocatedBps(heirs));
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

/** `amount × shareBps / 10000`, rounded down the way `HeritVault.payOut` rounds. */
export function shareOfAmount(amount: bigint, shareBps: number): bigint {
  return (amount * BigInt(shareBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * What a share is measured against: the snapshot once the unlock transition has run, the live
 * balance before it. Before the snapshot the result is an estimate — a deposit or withdrawal can
 * still change it.
 */
export function shareBase(vault: Vault, token: VaultToken): bigint {
  return vault.snapshotTaken ? token.snapshot : token.balance;
}

/** An heir's position in one token, or undefined when the heir row predates that token's listing. */
export function holdingOf(heir: Heir, token: Address): TokenShare | undefined {
  return heir.holdings.find((holding) => isAddressEqual(holding.token, token));
}

/** How far through their claim an heir is, counting only the tokens they have a share of. */
export function claimProgress(holdings: readonly TokenShare[]): { paid: number; of: number } {
  const owed = holdings.filter((holding) => holding.shareBps > 0);
  return { paid: owed.filter((holding) => holding.claimed).length, of: owed.length };
}

/** Largest number of fraction digits an amount shows. Enough for a demo, short enough for a chip. */
const FRACTION_DIGITS = 4;

/** A token amount in whole units, truncated rather than rounded so it never overstates. */
export function formatAmount(amount: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(amount, decimals).split(".");
  const kept = fraction.slice(0, FRACTION_DIGITS).replace(/0+$/, "");
  if (kept === "" && whole === "0" && amount > BigInt(0)) {
    return `<0.${"0".repeat(FRACTION_DIGITS - 1)}1`;
  }
  return kept === "" ? whole : `${whole}.${kept}`;
}

export function formatTokenAmount(amount: bigint, token: Pick<VaultToken, "decimals" | "symbol">): string {
  return `${formatAmount(amount, token.decimals)} ${token.symbol}`;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Takes anything with a label, so an estate, a discovered entry or a bare `{ label }` all work. */
export function fullName(estate: { label: string }, heirLabel?: string): string {
  return heirLabel
    ? `${heirLabel}.${estate.label}.herit.eth`
    : `${estate.label}.herit.eth`;
}

/** Heirs paired with their estate position, so a filtered list keeps its colours. */
export function indexedHeirs(heirs: readonly Heir[]): IndexedHeir[] {
  return heirs.map((heir, index) => ({ heir, index }));
}

/** Every heir but one — the co-heirs of the signed-in heir on the claim screen. */
export function coHeirs(heirs: readonly Heir[], label: string): IndexedHeir[] {
  return indexedHeirs(heirs).filter((entry) => entry.heir.label !== label);
}

/*//////////////////////////////////////////////////////////////
                         CLOCK RENDERING
//////////////////////////////////////////////////////////////*/

/**
 * Everything below draws a clock. None of it decides one.
 *
 * `HeritRegistry.statusOf` is the only thing that says where an estate sits in the state
 * machine, and the screens read it (`lib/estate/use-estate.ts`). These helpers take numbers the
 * chain already returned and turn them into a ring and a label — a countdown hitting zero here
 * changes nothing until the next read of `statusOf` says it did.
 */

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** When the check-in window closes, from the timers `estateOf` returned. */
export function windowEndsAt(clock: EstateClock): number | null {
  if (clock.checkInInterval === 0 || clock.lastCheckIn === 0) return null;
  return clock.lastCheckIn + clock.checkInInterval;
}

/** When heirs unlock, from the same timers. */
export function unlockAt(clock: EstateClock): number | null {
  const windowEnd = windowEndsAt(clock);
  return windowEnd === null ? null : windowEnd + clock.graceDuration;
}

/** The instant the ring counts toward, chosen by the status the chain reported. */
export function countdownTarget(status: EstateStatus, clock: EstateClock): number | null {
  if (status === "unlocked") return null;
  return status === "grace" ? unlockAt(clock) : windowEndsAt(clock);
}

/** The length of the current phase. */
export function phaseSeconds(status: EstateStatus, clock: EstateClock): number {
  if (status === "grace") return clock.graceDuration;
  if (status === "active") return clock.checkInInterval;
  return 0;
}

/** Seconds left before `target`. Never negative (A passed deadline reads as zero). */
export function secondsUntil(target: number | null, now: number): number {
  if (target === null) return 0;
  return Math.max(0, target - now);
}

/** 0 = phase just began, 1 = spent. Drives the countdown ring. */
export function windowProgress(total: number, remaining: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (total - remaining) / total));
}

/**
 * Formatted by hand from UTC parts rather than `Intl`, on purpose. These strings are rendered on
 * the server and again on the client; anything that reads the host timezone or a locale's ICU
 * tables can differ between the two and trip a hydration mismatch.
 */
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A point in time, as the activity feed and data rows show it. UTC. */
export function formatStamp(unixSeconds: number | null): string {
  if (unixSeconds === null || unixSeconds <= 0) return "—";
  const d = new Date(unixSeconds * 1000);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * The big number in the countdown ring. Coarse when there is a lot of time left, precise when
 * there is not — a demo estate with a two-minute interval needs to tick in seconds.
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / DAY);
  const h = Math.floor((s % DAY) / HOUR);
  const m = Math.floor((s % HOUR) / MINUTE);

  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${pad(h)}h ${pad(m)}m`;
  return `${pad(m)}:${pad(s % MINUTE)}`;
}

/** A configured window, as a label: "30 days", "10 mins". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s === 0) return "not set";
  if (s % DAY === 0) return plural(s / DAY, "day");
  if (s % HOUR === 0) return plural(s / HOUR, "hour");
  if (s % MINUTE === 0) return plural(s / MINUTE, "min");
  return plural(s, "sec");
}

/**
 * The deadline a list row shows, from the timers last read and the local clock.
 *
 * Like everything else here it draws a clock rather than deciding one: a zero reads as "confirming
 * on sepolia…" and waits for `statusOf` to agree, instead of announcing a transition itself.
 */
export function describeDeadline(
  status: EstateStatus,
  clock: EstateClock,
  now: number,
): { main: string; sub: string } {
  if (status === "unlocked") return { main: "unlocked", sub: "heirs can claim" };
  if (clock.checkInInterval === 0) return { main: "—", sub: "timers not set" };

  const target = countdownTarget(status, clock);
  if (target === null) return { main: "—", sub: "clock not started" };

  const remaining = secondsUntil(target, now);
  if (status === "grace") {
    return remaining > 0
      ? { main: formatCountdown(remaining), sub: "until heirs unlock" }
      : { main: "lapsed", sub: "confirming on sepolia…" };
  }
  return remaining > 0
    ? { main: formatCountdown(remaining), sub: "until the window closes" }
    : { main: "closed", sub: "confirming on sepolia…" };
}

/** How long ago something happened, coarsely: "2 days ago". */
export function formatAgo(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < MINUTE) return "just now";
  if (s < HOUR) return `${plural(Math.floor(s / MINUTE), "min")} ago`;
  if (s < DAY) return `${plural(Math.floor(s / HOUR), "hour")} ago`;
  return `${plural(Math.floor(s / DAY), "day")} ago`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
