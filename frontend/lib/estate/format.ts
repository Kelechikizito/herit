import {
  BPS_DENOMINATOR,
  type Estate,
  type EstateClock,
  type EstateStatus,
  type IndexedHeir,
} from "./types";

/** Formatting and derivation over an estate. Pure, no rendering, no fixtures. */

export function allocatedBps(estate: Estate): number {
  return estate.heirs.reduce((total, heir) => total + heir.shareBps, 0);
}

export function unallocatedBps(estate: Estate): number {
  return Math.max(0, BPS_DENOMINATOR - allocatedBps(estate));
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

/** An heir's cut of the vault, in ETH. */
export function shareOfVault(vaultEth: number, shareBps: number): number {
  return (vaultEth * shareBps) / BPS_DENOMINATOR;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function fullName(estate: Estate, heirLabel?: string): string {
  return heirLabel
    ? `${heirLabel}.${estate.label}.herit.eth`
    : `${estate.label}.herit.eth`;
}

/** Heirs paired with their estate position, so a filtered list keeps its colours. */
export function indexedHeirs(estate: Estate): IndexedHeir[] {
  return estate.heirs.map((heir, index) => ({ heir, index }));
}

/** Every heir but one — the co-heirs of the signed-in heir on the claim screen. */
export function coHeirs(estate: Estate, label: string): IndexedHeir[] {
  return indexedHeirs(estate).filter((entry) => entry.heir.label !== label);
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
