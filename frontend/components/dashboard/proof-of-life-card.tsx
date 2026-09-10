"use client";

import { useState } from "react";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { Sparkle } from "@/components/ui/deco";
import { ClockIcon, SelfieIcon } from "@/components/ui/icons";
import {
  type Estate,
  STATUS_COPY,
  countdownTarget,
  formatCountdown,
  formatDuration,
  formatStamp,
  phaseSeconds,
  secondsUntil,
  unlockAt,
  windowEndsAt,
  windowProgress,
} from "@/lib/estate";
import { useNow } from "@/lib/estate/use-now";

/**
 * The check-in clock, and the button that resets it. Owns the Selfie Check modal, which is why
 * this card — rather than the whole dashboard — holds the modal state.
 */
export function ProofOfLifeCard({ estate, now }: { estate: Estate; now: number }) {
  const [checkingIn, setCheckingIn] = useState(false);

  // `estate.status` is the pending status `estateOf` returned; the ring only draws it.
  const tick = useNow(now);
  const configured = estate.clock.checkInInterval > 0;
  // No deadline until the first Selfie Check lands, so nothing to count toward.
  const started = windowEndsAt(estate.clock) !== null;
  const unlocked = estate.status === "unlocked";

  const remaining = secondsUntil(countdownTarget(estate.status, estate.clock), tick);
  const total = phaseSeconds(estate.status, estate.clock);
  const progress = unlocked ? 1 : started ? windowProgress(total, remaining) : 0;

  const counting = unlocked
    ? "heirs unlocked"
    : !started
      ? "clock not started"
      : estate.status === "grace"
        ? "heirs unlock in"
        : "next check-in in";
  const body = !configured
    ? "the timers are not configured yet"
    : !started
      ? "the clock starts at your first selfie check"
      : STATUS_COPY[estate.status].blurb;

  return (
    <section className="card relative overflow-hidden p-6">
      <Sparkle className="right-5 top-5" size={22} fill="#C4B5FD" rotate={14} />

      <CardHeading icon={ClockIcon} accent="bg-lavender" title="proof of life" body={body} />

      <div className="my-7 flex justify-center">
        <CountdownRing progress={progress} status={estate.status} size={216}>
          <p className="text-[0.68rem] font-bold tracking-wide text-muted">{counting}</p>
          <p className="mono text-4xl font-extrabold leading-tight">
            {started && !unlocked ? formatCountdown(remaining) : "—"}
          </p>
          <p className="mt-1 text-[0.68rem] text-muted">
            {configured ? `of ${formatDuration(total || estate.clock.checkInInterval)}` : "no timers"}
          </p>
        </CountdownRing>
      </div>

      <button
        type="button"
        className="btn btn-pill w-full"
        onClick={() => setCheckingIn(true)}
      >
        <SelfieIcon size={18} />
        check in now
      </button>

      <dl className="mt-6 space-y-2.5 border-t-2 border-ink pt-5 text-sm">
        <DataRow label="last selfie check" value={formatStamp(estate.clock.lastCheckIn)} />
        <DataRow label="window closes" value={formatStamp(windowEndsAt(estate.clock))} />
        <DataRow label="heirs unlock at" value={formatStamp(unlockAt(estate.clock))} />
      </dl>

      <SelfieCheckModal
        open={checkingIn}
        purpose={{ kind: "checkin", estateLabel: estate.label }}
        onClose={() => setCheckingIn(false)}
        confirmLabel="reset the clock"
      />
    </section>
  );
}
