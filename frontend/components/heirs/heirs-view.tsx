"use client";

import { Loaded } from "@/components/estate/card-state";
import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { AddHeirForm } from "@/components/heirs/add-heir-form";
import { AllocationCard } from "@/components/heirs/allocation-card";
import { HeirTable } from "@/components/heirs/heir-table";
import { PageHeader } from "@/components/layout/page-header";
import { type OwnedEstate, estateLink, fullName } from "@/lib/estate";
import { useSelectedEstate } from "@/lib/estate/use-discovery";
import { useHeirs } from "@/lib/estate/use-heirs";
import { useVault } from "@/lib/estate/use-vault";

const toLink = (estate: OwnedEstate) => estateLink("/heirs", estate);

export function HeirsView({ requestedEstate }: { requestedEstate?: string }) {
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

  return <Heirs selected={resolved.selected} entries={resolved.entries} />;
}

/**
 * One estate's heirs. No `useEstate`: nothing here reads the clock. The vault is read only for its
 * token list, which each heir's claimed flags are keyed by.
 */
function Heirs({ selected, entries }: { selected: OwnedEstate; entries: readonly OwnedEstate[] }) {
  const vault = useVault(selected.estateId);
  const heirs = useHeirs(selected.estateId, selected.label, vault);

  return (
    <>
      <PageHeader
        eyebrow={fullName(selected)}
        title="heirs"
        starFill="#C4B5FD"
        starRotate={14}
        description="every heir is a subname inside this estate's own ENSv2 registry, carrying a relationship record, a share in basis points, and a claim role that stays withheld until the estate unlocks."
      />

      <EntrySwitcher label="your estates" links={entries.map(toLink)} current={toLink(selected)} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Loaded load={heirs} title="allocation">
            {(heirs) => <AllocationCard heirs={heirs} />}
          </Loaded>
          <Loaded load={heirs} title="registered heirs">
            {(heirs) => <HeirTable estateLabel={selected.label} heirs={heirs} />}
          </Loaded>
        </div>

        <Loaded load={heirs} title="name an heir">
          {(heirs) => <AddHeirForm estateLabel={selected.label} heirs={heirs} />}
        </Loaded>
      </div>
    </>
  );
}
