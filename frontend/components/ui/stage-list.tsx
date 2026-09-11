import { CheckIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";

/**
 * Stages, ticked off as a run progresses: done behind, one active, the rest waiting.
 *
 * Shared by the Selfie Check modal and the setup run, so a World ID check and a batch of
 * transactions report their progress in the same shape.
 */
export function StageList({
  stages,
  current,
  failed,
  className = "",
}: {
  stages: readonly { label: string; detail: string }[];
  /** How many stages are behind us. Equal to `stages.length` once everything is done. */
  current: number;
  /** Whether the run stopped at `current`, rather than still working on it. */
  failed: boolean;
  className?: string;
}) {
  return (
    <ol className={`space-y-2.5 ${className}`}>
      {stages.map((entry, index) => {
        const state =
          current > index
            ? "done"
            : current === index
              ? failed
                ? "failed"
                : "active"
              : "pending";
        return (
          <li key={entry.label} className="flex items-center gap-3">
            <IconCircle
              size="sm"
              accent={
                state === "done"
                  ? "bg-teal"
                  : state === "failed"
                    ? "bg-coral"
                    : state === "active"
                      ? "bg-yellow pulse-dot"
                      : "bg-surface"
              }
            >
              {state === "done" ? (
                <CheckIcon size={14} />
              ) : (
                <span className="mono text-[0.65rem] font-bold">{index + 1}</span>
              )}
            </IconCircle>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${state === "pending" ? "text-muted" : "text-ink"}`}>
                {entry.label}
              </p>
              <p className="truncate text-[0.72rem] text-muted">{entry.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
