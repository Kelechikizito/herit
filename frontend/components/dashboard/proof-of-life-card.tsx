"use client";

import { useState } from "react";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { Sparkle } from "@/components/ui/deco";
import { ClockIcon, SelfieIcon } from "@/components/ui/icons";
import { type Estate, STATUS_COPY } from "@/lib/estate";

/**
 * The check-in clock, and the button that resets it. Owns the Selfie Check modal, which is why
 * this card — rather than the whole dashboard — is the client boundary.
 */
export function ProofOfLifeCard({ estate }: { estate: Estate }) {
  const [checkingIn, setCheckingIn] = useState(false);

  return (
    <section className="card relative overflow-hidden p-6">
      <Sparkle className="right-5 top-5" size={22} fill="#C4B5FD" rotate={14} />

      <CardHeading
        icon={ClockIcon}
        accent="bg-lavender"
        title="proof of life"
        body={STATUS_COPY[estate.status].blurb}
      />

      <div className="my-7 flex justify-center">
        <CountdownRing progress={estate.progress} status={estate.status} size={216}>
          <p className="text-[0.68rem] font-bold tracking-wide text-muted">
            next check-in in
          </p>
          <p className="mono text-4xl font-extrabold leading-tight">{estate.remaining}</p>
          <p className="mt-1 text-[0.68rem] text-muted">of {estate.checkInInterval}</p>
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
        <DataRow label="last selfie check" value={estate.lastCheckIn} />
        <DataRow label="window closes" value={estate.windowCloses} />
        <DataRow label="heirs unlock at" value={estate.unlocksAt} />
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
