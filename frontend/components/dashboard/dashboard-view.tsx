"use client";

import { ActivityCard } from "@/components/dashboard/activity-card";
import { EstateSummaryCard } from "@/components/dashboard/estate-summary-card";
import { HeirsCard } from "@/components/dashboard/heirs-card";
import { ProofOfLifeCard } from "@/components/dashboard/proof-of-life-card";
import { VaultCard } from "@/components/dashboard/vault-card";
import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { StatusPill } from "@/components/estate/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { estateLink, fullName, type OwnedEstate, shortAddress } from "@/lib/estate";
import { useSelectedEstate } from "@/lib/estate/use-discovery";
import { sampleEstate } from "@/lib/fixtures/estate";

const toLink = (estate: OwnedEstate) => estateLink("/dashboard", estate);

export function DashboardView({
  now,
  requestedEstate,
}: {
  now: number;
  requestedEstate?: string;
}) {
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

  // Only the estate's name is read from chain so far. Phase C replaces the fixture behind every
  // card with `useEstate`, `useHeirs` and `useVault`.
  const estate = { ...sampleEstate(now), label: resolved.selected.label };

  return (
    <>
      <PageHeader
        eyebrow="grantor dashboard"
        title={fullName(estate)}
        mono
        description={
          <p className="text-xs">
            estate registry{" "}
            <span className="mono">{shortAddress(estate.estateRegistry)}</span> · sepolia
          </p>
        }
      >
        <StatusPill status={estate.status} />
      </PageHeader>

      <EntrySwitcher
        label="your estates"
        links={resolved.entries.map(toLink)}
        current={toLink(resolved.selected)}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <ProofOfLifeCard estate={estate} now={now} />

        <div className="space-y-6">
          <EstateSummaryCard estate={estate} />
          <HeirsCard estate={estate} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <ActivityCard estate={estate} />
        <VaultCard estate={estate} />
      </div>
    </>
  );
}
