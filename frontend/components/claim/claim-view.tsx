"use client";

import { ClaimCard } from "@/components/claim/claim-card";
import { CoHeirsCard } from "@/components/claim/co-heirs-card";
import { EstateFactsCard } from "@/components/claim/estate-facts-card";
import { UnlockBanner } from "@/components/claim/unlock-banner";
import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { PageHeader } from "@/components/layout/page-header";
import { formatAgo, formatStamp, fullName, heirSlotLink, unlockAt } from "@/lib/estate";
import { useSelectedHeirSlot } from "@/lib/estate/use-discovery";
import { SIGNED_IN_HEIR, unlockedEstate } from "@/lib/fixtures/estate";

export function ClaimView({
  now,
  requestedEstate,
  requestedHeir,
}: {
  now: number;
  requestedEstate?: string;
  requestedHeir?: string;
}) {
  const resolved = useSelectedHeirSlot({ estate: requestedEstate, heir: requestedHeir });

  if (resolved.kind !== "selected") {
    return (
      <SelectionNotice
        resolved={resolved}
        audience="heir"
        requested={requestedName(requestedEstate, requestedHeir)}
        toLink={heirSlotLink}
      />
    );
  }

  const { selected: slot, address } = resolved;

  // Only the slot is read from chain so far. Phase C replaces the fixture estate, heir row and
  // claim state below with `useEstate`, `useHeirs` and `useClaim`.
  const base = unlockedEstate(now);
  const estate = { ...base, label: slot.estateLabel };
  const demoHeir =
    base.heirs.find((candidate) => candidate.label === SIGNED_IN_HEIR) ?? base.heirs[0];
  const heir = { ...demoHeir, label: slot.heirLabel, address };

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

      <EntrySwitcher
        label="your claims"
        links={resolved.entries.map(heirSlotLink)}
        current={heirSlotLink(slot)}
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

/** The name the URL asked for, as specific as its params allow. */
function requestedName(estate?: string, heir?: string): string | undefined {
  if (estate === undefined) return heir;
  return heir === undefined ? `${estate}.herit.eth` : `${heir}.${estate}.herit.eth`;
}
