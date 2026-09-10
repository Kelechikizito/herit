"use client";

import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { AddHeirForm } from "@/components/heirs/add-heir-form";
import { AllocationCard } from "@/components/heirs/allocation-card";
import { HeirTable } from "@/components/heirs/heir-table";
import { PageHeader } from "@/components/layout/page-header";
import { estateLink, fullName, type OwnedEstate } from "@/lib/estate";
import { useSelectedEstate } from "@/lib/estate/use-discovery";
import { sampleEstate } from "@/lib/fixtures/estate";

const toLink = (estate: OwnedEstate) => estateLink("/heirs", estate);

export function HeirsView({ now, requestedEstate }: { now: number; requestedEstate?: string }) {
  const resolved = useSelectedEstate(requestedEstate);

  if (resolved.kind !== "selected") {
    return (
      <SelectionNotice
        resolved={resolved}
        audience="grantor"
        requested={requestedEstate === undefined ? undefined : `${requestedEstate}.herit.eth`}
        toLink={toLink}
      />
    );
  }

  // Only the estate's name is read from chain so far. Phase C replaces the fixture heirs with
  // `useHeirs`.
  const estate = { ...sampleEstate(now), label: resolved.selected.label };

  return (
    <>
      <PageHeader
        eyebrow={fullName(estate)}
        title="heirs"
        starFill="#C4B5FD"
        starRotate={14}
        description="every heir is a subname inside this estate's own ENSv2 registry, carrying a relationship record, a share in basis points, and a claim role that stays withheld until the estate unlocks."
      />

      <EntrySwitcher
        label="your estates"
        links={resolved.entries.map(toLink)}
        current={toLink(resolved.selected)}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-6">
          <AllocationCard estate={estate} />
          <HeirTable estate={estate} />
        </div>

        <AddHeirForm estate={estate} />
      </div>
    </>
  );
}
