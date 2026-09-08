import { ActivityCard } from "@/components/dashboard/activity-card";
import { EstateSummaryCard } from "@/components/dashboard/estate-summary-card";
import { HeirsCard } from "@/components/dashboard/heirs-card";
import { ProofOfLifeCard } from "@/components/dashboard/proof-of-life-card";
import { VaultCard } from "@/components/dashboard/vault-card";
import { StatusPill } from "@/components/estate/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { fullName, shortAddress } from "@/lib/estate";
import { SAMPLE_ESTATE } from "@/lib/fixtures/estate";

export default function DashboardPage() {
  const estate = SAMPLE_ESTATE;

  return (
    <div className="mx-auto max-w-6xl">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <ProofOfLifeCard estate={estate} />

        <div className="space-y-6">
          <EstateSummaryCard estate={estate} />
          <HeirsCard estate={estate} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <ActivityCard estate={estate} />
        <VaultCard estate={estate} />
      </div>
    </div>
  );
}
