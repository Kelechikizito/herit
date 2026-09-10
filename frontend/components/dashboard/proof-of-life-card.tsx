"use client";

import { useState } from "react";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { TxStatus } from "@/components/estate/tx-status";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { Sparkle } from "@/components/ui/deco";
import { ClockIcon, FastForwardIcon, SelfieIcon } from "@/components/ui/icons";
import { contracts } from "@/lib/contracts/contracts";
import {
  type Estate,
  type EstateStatus,
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
import { type Change, useChange } from "@/lib/estate/use-change";
import { useNow } from "@/lib/estate/use-now";
import { useAttestedAction } from "@/lib/wagmi/use-attested-action";
import { pendingLabel, useTransaction } from "@/lib/wagmi/use-transaction";

/**
 * The check-in clock, the button that resets it, and the permissionless poke that moves it on.
 * Owns the Selfie Check modal, which is why this card — rather than the whole dashboard — holds
 * the modal state.
 */
export function ProofOfLifeCard({
  estate,
  now,
  unlockRan,
}: {
  estate: Estate;
  now: number;
  /** The vault snapshot exists, so the unlock transition has already been stored. */
  unlockRan: boolean;
}) {
  const [checkingIn, setCheckingIn] = useState(false);
  const checkIn = useAttestedAction("checkin");
  const poke = useTransaction();
  // A transition seen while the card is open: grace cancelled by a check-in, a window that closed.
  const statusChange = useChange(estate.status);

  // `estate.status` is the pending status `estateOf` returned; the ring only draws it.
  const tick = useNow(now);
  const configured = estate.clock.checkInInterval > 0;
  // No deadline until the first Selfie Check lands, so nothing to count toward.
  const windowEnd = windowEndsAt(estate.clock);
  const started = windowEnd !== null;
  const unlocked = estate.status === "unlocked";

  const remaining = secondsUntil(countdownTarget(estate.status, estate.clock), tick);
  const total = phaseSeconds(estate.status, estate.clock);
  const progress = unlocked ? 1 : started ? windowProgress(total, remaining) : 0;
  // The local clock is past the deadline but the last read still reports the old status. The ring
  // does not decide it has passed — `useEstate` reads fast until `estateOf` says so.
  const overdue = started && !unlocked && remaining === 0;

  const counting = unlocked
    ? "heirs unlocked"
    : !started
      ? "clock not started"
      : estate.status === "grace"
        ? overdue
          ? "grace lapsed"
          : "heirs unlock in"
        : overdue
          ? "window closed"
          : "next check-in in";
  const body = !configured
    ? "the timers are not configured yet"
    : !started
      ? "the clock starts at your first selfie check"
      : STATUS_COPY[estate.status].blurb;

  const checkInBlocked = unlocked
    ? "the estate has unlocked — a check-in can no longer reverse it"
    : !configured
      ? "set the timers before the first check-in"
      : checkIn.blocked;

  // `deadlinesOf.graceStartsAt` is this same sum. Past it, `pokeExpiry` has something to store —
  // unless the unlock already ran, which the vault snapshot records.
  const pokeable = windowEnd !== null && tick >= windowEnd && !(unlocked && unlockRan);

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
            {!configured
              ? "no timers"
              : overdue
                ? "confirming on sepolia…"
                : `of ${formatDuration(total || estate.clock.checkInInterval)}`}
          </p>
        </CountdownRing>
      </div>

      {statusChange ? <StatusChangeNote key={statusChange.seq} change={statusChange} /> : null}

      <button
        type="button"
        className="btn btn-pill w-full"
        onClick={() => {
          checkIn.reset();
          setCheckingIn(true);
        }}
        disabled={checkInBlocked !== undefined || checkIn.busy}
      >
        <SelfieIcon size={18} />
        {estate.status === "grace" ? "check in and cancel grace" : "check in now"}
      </button>
      {checkInBlocked ? <p className="hint text-center">{checkInBlocked}</p> : null}

      {pokeable ? (
        <div className="mt-4 rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full"
            onClick={() =>
              poke.send({
                ...contracts.heritRegistry,
                functionName: "pokeExpiry",
                args: [estate.estateId],
              })
            }
            disabled={poke.busy || poke.blocked !== undefined}
          >
            <FastForwardIcon size={15} />
            {pendingLabel(poke.phase) ?? (unlocked ? "run the unlock now" : "record the missed check-in")}
          </button>
          <p className="hint">
            permissionless — anyone may call <span className="mono">pokeExpiry</span>, and it does
            nothing if there is nothing to record.
          </p>
          <TxStatus tx={poke} className="mt-2" />
        </div>
      ) : null}

      <dl className="mt-6 space-y-2.5 border-t-2 border-ink pt-5 text-sm">
        <DataRow label="last selfie check" value={formatStamp(estate.clock.lastCheckIn)} />
        <DataRow label="window closes" value={formatStamp(windowEndsAt(estate.clock))} />
        <DataRow label="heirs unlock at" value={formatStamp(unlockAt(estate.clock))} />
      </dl>

      <SelfieCheckModal
        open={checkingIn}
        purpose={{ kind: "checkin", estateLabel: estate.label }}
        onClose={() => setCheckingIn(false)}
        onVerified={checkIn.submit}
        submission={checkIn.submission}
        onResubmit={checkIn.submit}
        confirmLabel="done"
      />
    </section>
  );
}

/**
 * Keyed by where the estate went. `active` is only ever reached from grace — unlock is final — so
 * arriving there always means a check-in cancelled it.
 */
const CHANGE_COPY: Record<EstateStatus, { text: string; tone: string }> = {
  active: { text: "grace cancelled — your selfie check sealed the estate again", tone: "bg-teal" },
  grace: { text: "the check-in window closed — the estate is in grace", tone: "bg-yellow" },
  unlocked: { text: "grace lapsed — the estate has unlocked to its heirs", tone: "bg-coral text-white" },
};

/** The last status change seen on this card, in words. Stays until the next one. */
function StatusChangeNote({ change }: { change: Change<EstateStatus> }) {
  const copy = CHANGE_COPY[change.to];
  return (
    <p
      role="status"
      className={`pop-in mb-4 rounded-[8px] border-2 border-ink px-4 py-2.5 text-center text-xs font-bold ${copy.tone}`}
    >
      {copy.text}
    </p>
  );
}
