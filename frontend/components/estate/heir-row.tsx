import { type Estate, type Heir, bpsToPercent, fullName, shortAddress } from "@/lib/estate";
import { HeirAvatar } from "./heir-avatar";
import { ShareChip } from "./role-chip";

/** One heir, as a row: avatar, full subname, relationship and address, share, then whatever the
 * caller wants trailing it — a role chip, a delete button. Shared by the dashboard list and the
 * heir table. */
export function HeirRow({
  estate,
  heir,
  index,
  children,
}: {
  estate: Estate;
  heir: Heir;
  /** Position in the estate, which fixes the avatar colour. */
  index: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <HeirAvatar index={index} />
      <div className="min-w-[11rem] flex-1">
        <p className="mono truncate text-sm font-bold">{fullName(estate, heir.label)}</p>
        <p className="mt-0.5 text-xs text-muted">
          {heir.relationship} · <span className="mono">{shortAddress(heir.address)}</span>
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
        {children}
      </div>
    </div>
  );
}
