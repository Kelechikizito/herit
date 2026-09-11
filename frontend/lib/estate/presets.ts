import { DAY, HOUR, MINUTE } from "./format";

/** Timer presets offered during setup. Minutes, not months — ARCHITECTURE.md §9 wants the loop demoable live. */

export type Preset = { label: string; note: string; seconds: number };

export const INTERVAL_PRESETS: readonly Preset[] = [
  { label: "2 minutes", note: "demo speed", seconds: 2 * MINUTE },
  { label: "1 hour", note: "", seconds: HOUR },
  { label: "30 days", note: "realistic", seconds: 30 * DAY },
  { label: "90 days", note: "", seconds: 90 * DAY },
];

export const GRACE_PRESETS: readonly Preset[] = [
  { label: "1 minute", note: "demo speed", seconds: MINUTE },
  { label: "30 minutes", note: "", seconds: 30 * MINUTE },
  { label: "7 days", note: "realistic", seconds: 7 * DAY },
  { label: "14 days", note: "", seconds: 14 * DAY },
];
