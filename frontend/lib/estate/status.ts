import type { EstateStatus, LogKind } from "./types";

/** How each state presents itself: the pill label, the one-line explanation, the swatch. */
export const STATUS_COPY: Record<
  EstateStatus,
  { label: string; blurb: string; color: string }
> = {
  active: {
    label: "active",
    blurb: "proof of life is current — the estate is sealed",
    color: "bg-teal",
  },
  grace: {
    label: "grace",
    blurb: "a check-in was missed — one selfie check still reverses this",
    color: "bg-yellow",
  },
  unlocked: {
    label: "unlocked",
    blurb: "grace lapsed — heirs hold ROLE_HEIR_CLAIM and may claim",
    color: "bg-coral",
  },
};

/** The dot colour each kind of activity entry carries. */
export const LOG_COLOR: Record<LogKind, string> = {
  opened: "bg-lavender",
  checkin: "bg-teal",
  heir: "bg-pink",
  unlock: "bg-coral",
  claim: "bg-purple",
  deposit: "bg-surface",
};

/** The palette heirs are drawn from, in order, so an heir keeps its colour across screens. */
export const HEIR_COLORS = [
  "bg-coral",
  "bg-purple",
  "bg-teal",
  "bg-pink",
  "bg-lavender",
  "bg-yellow",
] as const;

export function heirColor(index: number): string {
  return HEIR_COLORS[index % HEIR_COLORS.length];
}
