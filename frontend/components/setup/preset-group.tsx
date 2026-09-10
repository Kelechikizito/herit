import type { Preset } from "@/lib/estate";

/**
 * One timer, chosen from presets. Demo speeds sit beside realistic ones deliberately.
 *
 * A preset outside the registry's bounds is shown but disabled, so a redeploy with tighter
 * constants explains itself rather than failing at `configure`.
 */
export function PresetGroup({
  legend,
  hint,
  presets,
  selected,
  onSelect,
  bounds,
}: {
  legend: string;
  hint: string;
  presets: readonly Preset[];
  /** The chosen duration, in seconds. */
  selected: number;
  onSelect: (seconds: number) => void;
  /** The registry's `[min, max]` for this timer, once read. */
  bounds?: readonly [number, number];
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {presets.map((preset) => {
          const allowed =
            bounds === undefined || (preset.seconds >= bounds[0] && preset.seconds <= bounds[1]);
          const active = preset.seconds === selected;
          return (
            <button
              key={preset.label}
              type="button"
              className={`rounded-[8px] border-2 border-ink px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                active ? "bg-yellow shadow-brut" : "bg-surface"
              }`}
              aria-pressed={active}
              disabled={!allowed}
              onClick={() => onSelect(preset.seconds)}
            >
              <span className="block text-sm font-bold">{preset.label}</span>
              {preset.note || !allowed ? (
                <span className="mt-0.5 block text-[0.68rem] text-muted">
                  {allowed ? preset.note : "outside the registry's range"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
