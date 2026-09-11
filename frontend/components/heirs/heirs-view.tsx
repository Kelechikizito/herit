"use client";

import { Loaded } from "@/components/estate/card-state";
import { ESTATE_DETAILS_ID, EstatesTable } from "@/components/estate/estates-table";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { AddHeirForm } from "@/components/heirs/add-heir-form";
import { AllocationCard } from "@/components/heirs/allocation-card";
import { HeirTable } from "@/components/heirs/heir-table";
import { PageHeader } from "@/components/layout/page-header";
import { type OwnedEstate, all, estateLink, fullName } from "@/lib/estate";
import { useSelectedEstate } from "@/lib/estate/use-discovery";
import { useEstate } from "@/lib/estate/use-estate";
import { useHeirs } from "@/lib/estate/use-heirs";
import { useVault } from "@/lib/estate/use-vault";

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

  return (
    <>
      <PageHeader
        eyebrow="your estates"
        title="heirs"
        starFill="#C4B5FD"
        starRotate={14}
        description="every heir is a subname inside its estate's own ENSv2 registry, carrying a relationship record, a share in basis points, and a claim role that stays withheld until the estate unlocks."
      />

      <EstatesTable
        entries={resolved.entries}
        selected={resolved.selected}
        pathname="/heirs"
        now={now}
      />

      {/* Keyed per estate, so a half-filled heir form never carries into another estate. */}
      <Heirs key={resolved.selected.label} selected={resolved.selected} />
    </>
  );
}

/**
 * One estate's heirs. The estate is read for its status alone — registering closes once it unlocks.
 * The vault is read only for its token list, which each heir's claimed flags are keyed by.
 */
function Heirs({ selected }: { selected: OwnedEstate }) {
  const estate = useEstate(selected.estateId, selected.label);
  const vault = useVault(selected.estateId);
  const heirs = useHeirs(selected.estateId, selected.label, vault);

  return (
    <section id={ESTATE_DETAILS_ID} className="mt-12 scroll-mt-28">
      <PageHeader
        level={2}
        eyebrow="naming heirs for"
        title={fullName(selected)}
        mono
        starFill="#C4B5FD"
        starRotate={14}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Loaded load={heirs} title="allocation">
            {(heirs) => <AllocationCard heirs={heirs} />}
          </Loaded>
          <Loaded load={heirs} title="registered heirs">
            {(heirs) => <HeirTable estateLabel={selected.label} heirs={heirs} />}
          </Loaded>
        </div>

        <Loaded load={all(estate, heirs)} title="name an heir">
          {([estate, heirs]) => <AddHeirForm estate={estate} heirs={heirs} />}
        </Loaded>
      </div>
    </section>
  );
}
