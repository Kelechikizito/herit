import { AddHeirForm } from "@/components/heirs/add-heir-form";
import { AllocationCard } from "@/components/heirs/allocation-card";
import { HeirTable } from "@/components/heirs/heir-table";
import { PageHeader } from "@/components/layout/page-header";
import { fullName } from "@/lib/estate";
import { SAMPLE_ESTATE } from "@/lib/fixtures/estate";

export default function HeirsPage() {
  const estate = SAMPLE_ESTATE;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={fullName(estate)}
        title="heirs"
        starFill="#C4B5FD"
        starRotate={14}
        description="every heir is a subname inside this estate's own ENSv2 registry, carrying a relationship record, a share in basis points, and a claim role that stays withheld until the estate unlocks."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-6">
          <AllocationCard estate={estate} />
          <HeirTable estate={estate} />
        </div>

        <AddHeirForm estate={estate} />
      </div>
    </div>
  );
}
