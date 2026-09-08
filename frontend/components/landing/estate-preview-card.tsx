import { HeirAvatar } from "@/components/estate/heir-avatar";
import { CountdownRing } from "@/components/estate/countdown-ring";
import { ShareChip } from "@/components/estate/role-chip";
import { StatusPill } from "@/components/estate/status-pill";
import { Blob, Star } from "@/components/ui/deco";
import { LockIcon } from "@/components/ui/icons";
import { bpsToPercent, type Estate, fullName, type Heir } from "@/lib/estate";
import { SAMPLE_ESTATE } from "@/lib/fixtures/estate";

/** How many heirs fit in the hero card before it starts crowding the ring. */
const PREVIEW_HEIRS = 2;

/**
 * A frozen snapshot of the dashboard, sitting beside the hero copy. Built from the same fixture
 * and the same components the app screens use, so the marketing page can never drift from them.
 */
export function EstatePreviewCard() {
  const estate = SAMPLE_ESTATE;

  return (
    <div className="relative">
      <Star className="-left-5 -top-5 z-20" size={34} fill="#F9A8B8" rotate={18} />

      <div className="card relative z-10 overflow-hidden p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-bold tracking-wide text-muted">estate</p>
            <p className="mono text-lg font-extrabold">{fullName(estate)}</p>
          </div>
          <StatusPill status={estate.status} />
        </div>

        <div className="my-6 flex justify-center">
          <CountdownRing progress={estate.progress} status={estate.status} size={190}>
            <p className="text-[0.68rem] font-bold tracking-wide text-muted">
              next check-in
            </p>
            <p className="mono text-3xl font-extrabold leading-tight">{estate.remaining}</p>
            <p className="mt-0.5 text-[0.68rem] text-muted">
              of a {estate.checkInInterval} window
            </p>
          </CountdownRing>
        </div>

        <div className="space-y-2">
          {estate.heirs.slice(0, PREVIEW_HEIRS).map((heir, index) => (
            <PreviewHeir key={heir.label} estate={estate} heir={heir} index={index} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[8px] border-2 border-ink bg-cream px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs font-bold">
            <LockIcon size={16} />
            ROLE_HEIR_CLAIM
          </span>
          <span className="mono text-xs font-bold">withheld</span>
        </div>
      </div>

      <Blob className="-bottom-6 -right-6 z-0" size={72} fill="#4ECDC4" />
    </div>
  );
}

function PreviewHeir({
  estate,
  heir,
  index,
}: {
  estate: Estate;
  heir: Heir;
  index: number;
}) {
  return (
    <div className="card-flat flex items-center gap-3 px-3 py-2.5">
      <HeirAvatar index={index} size="md" />
      <div className="min-w-0 flex-1">
        <p className="mono truncate text-[0.78rem] font-bold">
          {fullName(estate, heir.label)}
        </p>
        <p className="text-[0.68rem] text-muted">{heir.relationship}</p>
      </div>
      <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
    </div>
  );
}
