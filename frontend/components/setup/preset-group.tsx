import type { Preset } from "@/lib/estate";

/** One timer, chosen from presets. Demo speeds sit beside realistic ones deliberately. */
export function PresetGroup({
  legend,
  hint,
  presets,
  selected,
}: {
  legend: string;
  hint: string;
  presets: readonly Preset[];
  selected: string;
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`rounded-[8px] border-2 border-ink px-3 py-3 text-left ${
              preset.label === selected ? "bg-yellow shadow-brut" : "bg-surface"
            }`}
            aria-pressed={preset.label === selected}
          >
            <span className="block text-sm font-bold">{preset.label}</span>
            {preset.note ? (
              <span className="mt-0.5 block text-[0.68rem] text-muted">{preset.note}</span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
