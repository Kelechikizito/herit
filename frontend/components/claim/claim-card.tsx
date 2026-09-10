"use client";

import { useState } from "react";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { Sparkle } from "@/components/ui/deco";
import { AlertIcon, CheckIcon, SelfieIcon, VaultIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import {
  type Estate,
  type Heir,
  bpsToPercent,
  shareOfVault,
  shortAddress,
} from "@/lib/estate";

export function ClaimCard({
  estate,
  heir,
  graceLapsed,
}: {
  estate: Estate;
  heir: Heir;
  graceLapsed: string;
}) {
  const [claiming, setClaiming] = useState(false);
  const share = shareOfVault(estate.vaultEth, heir.shareBps);

  return (
    <section className="card relative overflow-hidden p-6">
      <Sparkle className="right-5 top-5" size={22} fill="#FFE566" rotate={-14} />

      <CardHeading
        icon={VaultIcon}
        accent="bg-coral text-white"
        title="your share"
        body="released from HeritVault on a valid claim"
      />

      <div className="my-7 flex justify-center">
        <CountdownRing progress={1} status="unlocked" size={200}>
          <p className="text-[0.68rem] font-bold tracking-wide text-muted">claimable</p>
          <p className="mono text-4xl font-extrabold leading-tight">{share.toFixed(2)}</p>
          <p className="mt-0.5 text-[0.68rem] text-muted">
            ETH · {bpsToPercent(heir.shareBps)} of {estate.vaultEth}
          </p>
        </CountdownRing>
      </div>

      <button
        type="button"
        className="btn btn-pill w-full"
        onClick={() => setClaiming(true)}
      >
        <SelfieIcon size={18} />
        selfie check and claim
      </button>

      <ul className="mt-6 space-y-3 border-t-2 border-ink pt-5">
        <Requirement met label="estate is unlocked" detail={graceLapsed} />
        <Requirement
          met
          label="you control the subname"
          detail={`addr(60) matches ${shortAddress(heir.address)}`}
        />
        <Requirement
          met={false}
          label="your selfie check"
          detail="one uniqueness proof, scoped to this claim"
        />
      </ul>

      <SelfieCheckModal
        open={claiming}
        purpose={{ kind: "claim", estateLabel: estate.label, heirLabel: heir.label }}
        onClose={() => setClaiming(false)}
        confirmLabel="release my share"
      />
    </section>
  );
}

/** One of the three conditions `ClaimManager` checks before releasing anything. */
function Requirement({
  met,
  label,
  detail,
}: {
  met: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <IconCircle size="xs" accent={met ? "bg-teal" : "bg-surface"}>
        {met ? <CheckIcon size={13} /> : <AlertIcon size={12} />}
      </IconCircle>
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}
