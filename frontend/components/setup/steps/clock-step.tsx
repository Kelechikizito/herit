import { PresetGroup } from "@/components/setup/preset-group";
import { CardHeading } from "@/components/ui/card-heading";
import { ClockIcon } from "@/components/ui/icons";
import { SETUP_DEFAULTS } from "@/lib/content/setup";
import { GRACE_PRESETS, INTERVAL_PRESETS } from "@/lib/estate";

/** Step two: the check-in interval and the grace period that follows a missed one. */
export function ClockStep() {
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
          selected={SETUP_DEFAULTS.interval}
        />
        <PresetGroup
          legend="grace period"
          hint="miss this too and heirs gain the claim role"
          presets={GRACE_PRESETS}
          selected={SETUP_DEFAULTS.grace}
        />
      </div>

      <div className="mt-8 rounded-[10px] border-2 border-ink bg-cream px-5 py-4">
        <p className="text-sm font-bold">
          your heirs can claim <span className="mono">{SETUP_DEFAULTS.unlocksAfter}</span>{" "}
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
