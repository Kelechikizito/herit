import { PresetGroup } from "@/components/setup/preset-group";
import { CardHeading } from "@/components/ui/card-heading";
import { ClockIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import {
  GRACE_PRESETS,
  INTERVAL_PRESETS,
  type Load,
  type SetupLimits,
  formatDuration,
  timerProblem,
} from "@/lib/estate";

/** Step two: the check-in interval and the grace period that follows a missed one. */
export function ClockStep({
  intervalSeconds,
  graceSeconds,
  limits,
  onInterval,
  onGrace,
}: {
  intervalSeconds: number;
  graceSeconds: number;
  limits: Load<SetupLimits>;
  onInterval: (seconds: number) => void;
  onGrace: (seconds: number) => void;
}) {
  const bounds = limits.status === "ready" ? limits.data : undefined;
  const problem = bounds ? timerProblem(intervalSeconds, graceSeconds, bounds) : undefined;

  return (
    <div>
      <CardHeading
        size="lg"
        icon={ClockIcon}
        accent="bg-teal"
        title="set your two timers"
        body="the interval is how often you must pass a selfie check. the grace period is your margin for travel, illness, or a bad network day — a single check-in during grace puts everything back."
      />

      <div className="mt-7 space-y-7">
        <PresetGroup
          legend="check-in interval"
          hint="miss this and the estate enters grace"
          presets={INTERVAL_PRESETS}
          selected={intervalSeconds}
          onSelect={onInterval}
          bounds={bounds ? [bounds.minInterval, bounds.maxInterval] : undefined}
        />
        <PresetGroup
          legend="grace period"
          hint="miss this too and heirs gain the claim role"
          presets={GRACE_PRESETS}
          selected={graceSeconds}
          onSelect={onGrace}
          bounds={bounds ? [bounds.minGrace, bounds.maxGrace] : undefined}
        />
      </div>

      {problem ? <AlertNote className="mt-4">{problem}</AlertNote> : null}
      {limits.status === "error" ? (
        <AlertNote className="mt-4">
          could not read the registry&apos;s timer bounds, so these are not checked yet.
        </AlertNote>
      ) : null}

      <div className="mt-8 rounded-[10px] border-2 border-ink bg-cream px-5 py-4">
        <p className="text-sm font-bold">
          your heirs can claim <span className="mono">{formatDuration(intervalSeconds + graceSeconds)}</span>{" "}
          after your last selfie check.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          the transition is permissionless — anyone may poke the registry once the window
          lapses, so unlocking never depends on herit being online.
        </p>
      </div>
    </div>
  );
}
