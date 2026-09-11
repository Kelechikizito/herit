import { DAY, type Estate, HOUR, estateIdOf } from "@/lib/estate";

/*
 * Sample estate content for the landing page's preview card. Marketing, not app state: no app
 * screen imports this, and none may fall back to it.
 */

/**
 * The instant the preview is drawn at.
 */
export const DESIGN_NOW = Math.floor(Date.UTC(2026, 2, 14, 9, 42) / 1000);

/** Just what the preview card draws of an heir. */
export type SampleHeir = {
  label: string;
  relationship: string;
  shareBps: number;
};

export const SAMPLE_HEIRS: readonly SampleHeir[] = [
  { label: "son", relationship: "son", shareBps: 4_000 },
  { label: "kate", relationship: "spouse", shareBps: 3_500 },
  { label: "mara", relationship: "daughter", shareBps: 1_500 },
];

/** A healthy estate, roughly two thirds through a 30-day window. */
export function sampleEstate(now: number = DESIGN_NOW): Estate {
  return {
    estateId: estateIdOf("alice"),
    label: "alice",
    grantor: "0x8fA3B21c4Dd0b9E1c73eA5f10c2B9d4aE6913C77",
    estateRegistry: "0x2b4c9E7f1A6d38B05Cc4e21F9a7D5308eB16C0aF",
    status: "active",
    clock: {
      lastCheckIn: now - (18 * DAY + 20 * HOUR),
      checkInInterval: 30 * DAY,
      graceDuration: 7 * DAY,
    },
  };
}
