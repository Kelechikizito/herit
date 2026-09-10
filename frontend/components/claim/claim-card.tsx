"use client";

import { useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { Sparkle } from "@/components/ui/deco";
import { AlertIcon, CheckIcon, SelfieIcon, VaultIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import {
  type Claimable,
  type Estate,
  type Heir,
  type Vault,
  type VaultToken,
  bpsToPercent,
  claimProgress,
  formatStamp,
  formatTokenAmount,
  holdingOf,
  shareOfAmount,
  shortAddress,
  unlockAt,
} from "@/lib/estate";
import { useChange } from "@/lib/estate/use-change";
import { useAttestedAction } from "@/lib/wagmi/use-attested-action";

export function ClaimCard({
  estate,
  heir,
  vault,
  claimable,
  address,
}: {
  estate: Estate;
  heir: Heir;
  vault: Vault;
  claimable: readonly Claimable[];
  /** The connected wallet. */
  address: Address;
}) {
  const [claiming, setClaiming] = useState(false);
  const claim = useAttestedAction("claim");

  // The three things `ClaimManager` checks, from `statusOf`, `heirAddressOf` and `hasClaimed`.
  // Never `canClaim`: it reads false for a lapsed estate nobody has poked, and the claim pokes.
  const unlocked = estate.status === "unlocked";
  const unlocksAt = unlockAt(estate.clock);
  const controls = isAddressEqual(heir.address, address);
  const { paid, of } = claimProgress(heir.holdings);
  const allPaid = of > 0 && paid === of;
  const unclaimed = of > 0 && !allPaid;

  const refusal = !unlocked
    ? "claims open once the estate unlocks"
    : !controls
      ? "connect the wallet recorded for this heir"
      : !unclaimed
        ? allPaid
          ? "your share has been paid out"
          : "the vault holds nothing for you yet"
        : claim.blocked;

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
        <CountdownRing progress={1} status={estate.status} size={200}>
          <p className="text-[0.68rem] font-bold tracking-wide text-muted">your share</p>
          <p className="mono text-4xl font-extrabold leading-tight">{bpsToPercent(heir.shareBps)}</p>
          <p className="mt-0.5 text-[0.68rem] text-muted">of every asset in the vault</p>
        </CountdownRing>
      </div>

      <ul className="mb-6 space-y-2">
        {vault.tokens.length === 0 ? (
          <li className="text-center text-xs text-muted">the vault holds nothing yet</li>
        ) : (
          vault.tokens.map((token) => (
            <TokenLine key={token.token} token={token} heir={heir} vault={vault} claimable={claimable} />
          ))
        )}
      </ul>

      <button
        type="button"
        className="btn btn-pill w-full"
        onClick={() => {
          claim.reset();
          setClaiming(true);
        }}
        disabled={refusal !== undefined || claim.busy}
      >
        <SelfieIcon size={18} />
        selfie check and claim
      </button>
      {refusal ? <p className="hint text-center">{refusal}</p> : null}

      <ul className="mt-6 space-y-3 border-t-2 border-ink pt-5">
        <Requirement
          met={unlocked}
          label="estate is unlocked"
          detail={
            unlocked
              ? unlocksAt === null
                ? "grace lapsed"
                : `grace lapsed on ${formatStamp(unlocksAt)}`
              : unlocksAt === null
                ? "the grantor's clock has not started"
                : `not before ${formatStamp(unlocksAt)}, and only if the grantor stops checking in`
          }
        />
        <Requirement
          met={controls}
          label="you control the heir slot"
          detail={
            controls
              ? `recorded to ${shortAddress(heir.address)}`
              : `recorded to ${shortAddress(heir.address)}, not this wallet`
          }
        />
        <Requirement
          met={of > 0 && !allPaid}
          label="your share is unclaimed"
          detail={
            allPaid
              ? "every asset has been paid out"
              : of === 0
                ? "there is nothing in the vault for you yet"
                : paid > 0
                  ? `${paid} of ${of} assets paid out`
                  : "nothing paid out yet"
          }
        />
        <Requirement
          met={heir.canClaim}
          label="claim role on your subname"
          detail={
            heir.canClaim
              ? "ROLE_HEIR_CLAIM granted — the unlock has run"
              : unlocked
                ? "not granted yet — your claim runs the unlock first, then grants it"
                : "withheld until the estate unlocks"
          }
        />
      </ul>

      <SelfieCheckModal
        open={claiming}
        purpose={{ kind: "claim", estateLabel: estate.label, heirLabel: heir.label }}
        onClose={() => setClaiming(false)}
        onVerified={claim.submit}
        submission={claim.submission}
        onResubmit={claim.submit}
        confirmLabel="done"
      />
    </section>
  );
}

/**
 * One asset: what was paid, what the claim will pay, or — before the unlock transition has frozen
 * the balances — an estimate off today's balance.
 */
function TokenLine({
  token,
  heir,
  vault,
  claimable,
}: {
  token: VaultToken;
  heir: Heir;
  vault: Vault;
  claimable: readonly Claimable[];
}) {
  const holding = holdingOf(heir, token.token);
  const shareBps = holding?.shareBps ?? 0;

  let amount: bigint;
  let note: string;
  if (holding?.claimed) {
    amount = shareOfAmount(token.snapshot, shareBps);
    note = "claimed";
  } else if (vault.snapshotTaken) {
    amount = claimable.find((entry) => isAddressEqual(entry.token, token.token))?.amount ?? BigInt(0);
    note = "claimable";
  } else {
    amount = shareOfAmount(token.balance, shareBps);
    note = "estimate";
  }

  return (
    <li className="flex items-baseline justify-between gap-3 rounded-[8px] border-2 border-ink bg-cream px-4 py-2.5">
      <span className="mono text-sm font-bold">{formatTokenAmount(amount, token)}</span>
      <span className="text-xs font-bold text-muted">{note}</span>
    </li>
  );
}

/**
 * One of the conditions `ClaimManager` checks before releasing anything. Pops when it becomes met
 * while the page is open — the estate unlocking, or the claim role landing on the subname.
 */
function Requirement({
  met,
  label,
  detail,
}: {
  met: boolean;
  label: string;
  detail: string;
}) {
  const change = useChange(met);

  return (
    <li className="flex items-start gap-3">
      <IconCircle
        key={change?.seq}
        size="xs"
        accent={met ? "bg-teal" : "bg-surface"}
        className={change?.to ? "flash-change" : ""}
      >
        {met ? <CheckIcon size={13} /> : <AlertIcon size={12} />}
      </IconCircle>
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}
