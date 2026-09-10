"use client";

import { useState } from "react";
import { ClaimCard } from "@/components/claim/claim-card";
import { CoHeirsCard } from "@/components/claim/co-heirs-card";
import { EstateFactsCard } from "@/components/claim/estate-facts-card";
import { UnlockBanner } from "@/components/claim/unlock-banner";
import { PageHeader } from "@/components/layout/page-header";
import { WalletIcon } from "@/components/ui/icons";
import { WalletPicker } from "@/components/wallet/wallet-picker";
import { formatAgo, formatStamp, fullName, unlockAt } from "@/lib/estate";
import { SIGNED_IN_HEIR, unlockedEstate } from "@/lib/fixtures/estate";
import { useWallet } from "@/lib/wagmi/use-wallet";

export function ClaimView({ now }: { now: number }) {
  const { address, isConnected, isReconnecting } = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isReconnecting) {
    return <ClaimNotice title="checking your wallet" body="restoring the last connection." />;
  }

  if (!isConnected || address === undefined) {
    return (
      <>
        <ClaimNotice
          title="connect to see your claim"
          body="a claim is scoped to the wallet that controls the heir subname, so herit needs to know which wallet is asking."
          action={
            <button type="button" className="btn mt-5" onClick={() => setPickerOpen(true)}>
              <WalletIcon size={14} />
              connect wallet
            </button>
          }
        />
        <WalletPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    );
  }

  const estate = unlockedEstate(now);
  const named = estate.heirs.find(
    (candidate) => candidate.address.toLowerCase() === address.toLowerCase(),
  );
  const demoSlot =
    estate.heirs.find((candidate) => candidate.label === SIGNED_IN_HEIR) ?? estate.heirs[0];
  const heir = named ?? { ...demoSlot, address };

  const unlockedAt = unlockAt(estate.clock);
  const since = unlockedAt === null ? "unlocked" : `unlocked ${formatAgo(now - unlockedAt)}`;
  const graceLapsed =
    unlockedAt === null ? "grace lapsed" : `grace lapsed on ${formatStamp(unlockedAt)}`;

  return (
    <>
      <PageHeader
        eyebrow="heir view"
        title={fullName(estate, heir.label)}
        mono
        starFill="#F9A8B8"
        starRotate={12}
        description={`you are named as ${heir.relationship} under ${fullName(estate)}. your claim role was dormant until the grantor's grace period lapsed.`}
      />

      <UnlockBanner since={since} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <ClaimCard estate={estate} heir={heir} graceLapsed={graceLapsed} />

        <div className="space-y-6">
          <EstateFactsCard estate={estate} />
          <CoHeirsCard estate={estate} heirLabel={heir.label} />
        </div>
      </div>
    </>
  );
}

function ClaimNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <span className="icon-box mx-auto bg-lavender">
        <WalletIcon size={22} />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
