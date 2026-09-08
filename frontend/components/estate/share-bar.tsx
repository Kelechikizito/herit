import { BPS_DENOMINATOR, type Estate, heirColor } from "@/lib/estate";

export type ShareSegment = { label: string; bps: number; color: string };

/** Turns an estate's heirs into the bar's segments, keeping each heir's palette colour. */
export function heirSegments(estate: Estate): ShareSegment[] {
  return estate.heirs.map((heir, index) => ({
    label: heir.label,
    bps: heir.shareBps,
    color: heirColor(index),
  }));
}

/** Horizontal share meter, segmented per heir, with the unallocated remainder hatched out. */
export function ShareBar({ segments }: { segments: readonly ShareSegment[] }) {
  const allocated = segments.reduce((total, segment) => total + segment.bps, 0);
  const remainder = Math.max(0, BPS_DENOMINATOR - allocated);

  return (
    <div className="flex h-7 w-full overflow-hidden rounded-[6px] border-2 border-ink bg-cream">
      {segments.map((segment, index) => (
        <div
          key={segment.label}
          className={`${segment.color} flex items-center justify-center ${
            index > 0 ? "border-l-2 border-ink" : ""
          }`}
          style={{ width: `${segment.bps / 100}%` }}
          title={`${segment.label} — ${(segment.bps / 100).toFixed(0)}%`}
        >
          <span className="truncate px-1 text-[0.65rem] font-bold">
            {segment.bps >= 800 ? segment.label : ""}
          </span>
        </div>
      ))}
      {remainder > 0 ? (
        <div
          className="flex items-center justify-center border-l-2 border-ink"
          style={{
            width: `${remainder / 100}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, #EDEDDA 0 6px, #FAFADF 6px 12px)",
          }}
          title={`unallocated — ${(remainder / 100).toFixed(0)}%`}
        >
          <span className="truncate px-1 text-[0.65rem] font-bold text-muted">
            {remainder >= 1_200 ? "unallocated" : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
