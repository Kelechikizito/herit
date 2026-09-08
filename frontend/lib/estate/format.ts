import { BPS_DENOMINATOR, type Estate, type IndexedHeir } from "./types";

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
