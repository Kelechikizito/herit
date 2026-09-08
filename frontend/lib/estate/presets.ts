/** Timer presets offered during setup. Minutes, not months — ARCHITECTURE.md §9 wants the loop demoable live. */

export type Preset = { label: string; note: string };

export const INTERVAL_PRESETS: readonly Preset[] = [
  { label: "2 minutes", note: "demo speed" },
  { label: "1 hour", note: "" },
  { label: "30 days", note: "realistic" },
  { label: "90 days", note: "" },
];

export const GRACE_PRESETS: readonly Preset[] = [
  { label: "1 minute", note: "demo speed" },
  { label: "30 minutes", note: "" },
  { label: "7 days", note: "realistic" },
  { label: "14 days", note: "" },
];
