import type { HeirSlot, OwnedEstate } from "./types";

/**
 * Picking the one estate or heir slot a screen shows, out of what discovery found.
 *
 * A URL param only chooses among entries the chain already tied to the connected wallet. It never
 * adds one, so a hand-edited link can narrow what a screen shows but cannot widen it.
 */

export type Selection<T> =
  | { kind: "empty" }
  | { kind: "not-found"; entries: readonly T[] }
  | { kind: "selected"; selected: T; entries: readonly T[] };

/** Where a switcher, or the list under a "not found", sends you for one entry. */
export type EntryLink = { href: string; label: string };

/** The estate named `label`, or the first one found when no label was asked for. */
export function selectEstate(
  entries: readonly OwnedEstate[],
  label: string | undefined,
): Selection<OwnedEstate> {
  return select(entries, label === undefined ? undefined : (entry) => entry.label === label);
}

/** The slot matching every param given, or the first slot found when none was. */
export function selectHeirSlot(
  entries: readonly HeirSlot[],
  { estate, heir }: { estate?: string; heir?: string },
): Selection<HeirSlot> {
  if (estate === undefined && heir === undefined) return select(entries, undefined);

  return select(
    entries,
    (entry) =>
      (estate === undefined || entry.estateLabel === estate) &&
      (heir === undefined || entry.heirLabel === heir),
  );
}

function select<T>(
  entries: readonly T[],
  matches: ((entry: T) => boolean) | undefined,
): Selection<T> {
  // No entries at all outranks a param that matches none: "open an estate" helps, "you have no
  // estate named x" does not.
  if (entries.length === 0) return { kind: "empty" };
  if (matches === undefined) return { kind: "selected", selected: entries[0], entries };

  const selected = entries.find(matches);
  return selected === undefined
    ? { kind: "not-found", entries }
    : { kind: "selected", selected, entries };
}

/** A grantor screen, scoped to one estate. */
export function estateHref(pathname: string, estateLabel: string): string {
  return `${pathname}?${new URLSearchParams({ estate: estateLabel }).toString()}`;
}

export function estateLink(pathname: string, estate: OwnedEstate): EntryLink {
  return { href: estateHref(pathname, estate.label), label: `${estate.label}.herit.eth` };
}

export function heirSlotLink(slot: HeirSlot): EntryLink {
  const query = new URLSearchParams({ estate: slot.estateLabel, heir: slot.heirLabel });
  return {
    href: `/claim?${query.toString()}`,
    label: `${slot.heirLabel}.${slot.estateLabel}.herit.eth`,
  };
}

/** One query param as a page received it: the first value, and never an empty string. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "" ? undefined : first;
}
