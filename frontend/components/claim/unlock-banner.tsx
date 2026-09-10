import { UnlockIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";

/** The banner an heir lands on once grace has lapsed. */
export function UnlockBanner({ since }: { since: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[10px] border-2 border-ink bg-coral px-5 py-4 text-white shadow-brut">
      <IconCircle size="xl" accent="bg-surface" className="text-ink">
        <UnlockIcon size={20} />
      </IconCircle>
      <div className="min-w-[16rem] flex-1">
        <p className="text-sm font-bold">the estate has unlocked</p>
        <p className="mt-0.5 text-xs text-white/85">
          ROLE_HEIR_CLAIM was granted on your subname when grace lapsed. one selfie check of
          your own releases your share.
        </p>
      </div>
      <span className="tag tag-shadow flex-shrink-0 bg-surface text-ink">{since}</span>
    </div>
  );
}
