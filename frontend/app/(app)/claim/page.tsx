import { ClaimCard } from "@/components/claim/claim-card";
import { CoHeirsCard } from "@/components/claim/co-heirs-card";
import { EstateFactsCard } from "@/components/claim/estate-facts-card";
import { UnlockBanner } from "@/components/claim/unlock-banner";
import { PageHeader } from "@/components/layout/page-header";
import { formatAgo, formatStamp, fullName, nowSeconds, unlockAt } from "@/lib/estate";
import { SIGNED_IN_HEIR, unlockedEstate } from "@/lib/fixtures/estate";

export default function ClaimPage() {
  const now = nowSeconds();
  const estate = unlockedEstate(now);
  const heir =
    estate.heirs.find((candidate) => candidate.label === SIGNED_IN_HEIR) ?? estate.heirs[0];

  // The unlock instant is the one fact the whole screen hangs off: it is when the heir's claim
  // role stopped being dormant.
  const unlockedAt = unlockAt(estate.clock);
  const since =
    unlockedAt === null ? "unlocked" : `unlocked ${formatAgo(now - unlockedAt)}`;
  const graceLapsed =
    unlockedAt === null ? "grace lapsed" : `grace lapsed on ${formatStamp(unlockedAt)}`;

  return (
    <div className="mx-auto max-w-6xl">
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
    </div>
  );
}
