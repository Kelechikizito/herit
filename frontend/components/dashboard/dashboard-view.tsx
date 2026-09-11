"use client";

import { ActivityCard } from "@/components/dashboard/activity-card";
import { EstateSummaryCard } from "@/components/dashboard/estate-summary-card";
import { HeirsCard } from "@/components/dashboard/heirs-card";
import { ProofOfLifeCard } from "@/components/dashboard/proof-of-life-card";
import { VaultCard } from "@/components/dashboard/vault-card";
import { Loaded } from "@/components/estate/card-state";
import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { StatusPill } from "@/components/estate/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import {
  type Heir,
  type OwnedEstate,
  type VaultToken,
  all,
  estateLink,
  fullName,
  shortAddress,
} from "@/lib/estate";
import { useEstateActivity } from "@/lib/estate/use-activity";
import { useSelectedEstate } from "@/lib/estate/use-discovery";
import { useEstate } from "@/lib/estate/use-estate";
import { useHeirs } from "@/lib/estate/use-heirs";
import { useVault } from "@/lib/estate/use-vault";

const toLink = (estate: OwnedEstate) => estateLink("/dashboard", estate);

const NO_HEIRS: readonly Heir[] = [];
const NO_TOKENS: readonly VaultToken[] = [];

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

  return <Dashboard now={now} selected={resolved.selected} entries={resolved.entries} />;
}

/** One estate's dashboard. Split out so its reads only start once an estate is chosen. */
function Dashboard({
  now,
  selected,
  entries,
}: {
  now: number;
  selected: OwnedEstate;
  entries: readonly OwnedEstate[];
}) {
  const estate = useEstate(selected.estateId, selected.label);
  const vault = useVault(selected.estateId);
  const heirs = useHeirs(selected.estateId, selected.label, vault);
  const activity = useEstateActivity(selected.estateId);

  return (
    <>
      <PageHeader
        eyebrow="grantor dashboard"
        title={fullName(selected)}
        mono
        description={
          <p className="text-xs">
            estate registry{" "}
            <span className="mono">
              {estate.status === "ready" ? shortAddress(estate.data.estateRegistry) : "…"}
            </span>{" "}
            · sepolia
          </p>
        }
      >
        {estate.status === "ready" ? <StatusPill status={estate.data.status} /> : null}
      </PageHeader>

      <EntrySwitcher label="your estates" links={entries.map(toLink)} current={toLink(selected)} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <Loaded load={estate} title="proof of life">
          {(estate) => (
            <ProofOfLifeCard
              estate={estate}
              now={now}
              unlockRan={vault.status === "ready" && vault.data.snapshotTaken}
            />
          )}
        </Loaded>

        <div className="space-y-6">
          <Loaded load={all(estate, heirs, vault)} title="the estate">
            {([estate, heirs, vault]) => (
              <EstateSummaryCard estate={estate} heirs={heirs} vault={vault} />
            )}
          </Loaded>
          <Loaded load={heirs} title="heirs">
            {(heirs) => <HeirsCard estateLabel={selected.label} heirs={heirs} />}
          </Loaded>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* The feed never waits on heirs or the vault: it names what they have loaded so far. */}
        <ActivityCard
          activity={activity}
          context={{
            estateLabel: selected.label,
            heirs: heirs.status === "ready" ? heirs.data : NO_HEIRS,
            tokens: vault.status === "ready" ? vault.data.tokens : NO_TOKENS,
          }}
        />
        <Loaded load={all(estate, heirs, vault)} title="vault">
          {([estate, heirs, vault]) => <VaultCard estate={estate} heirs={heirs} vault={vault} />}
        </Loaded>
      </div>
    </>
  );
}
