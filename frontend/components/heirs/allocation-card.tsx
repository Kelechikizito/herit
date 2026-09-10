import { ShareBar, heirSegments } from "@/components/estate/share-bar";
import { CardHeading } from "@/components/ui/card-heading";
import { TreeIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import { StatBox } from "@/components/ui/stat-box";
import { type Heir, allocatedBps, bpsToPercent, unallocatedBps } from "@/lib/estate";

/** How the estate is divided, and how much of it is still unspoken for. */
export function AllocationCard({ heirs }: { heirs: readonly Heir[] }) {
  const allocated = allocatedBps(heirs);
  const unallocated = unallocatedBps(heirs);

  return (
    <section className="card p-6">
      <CardHeading
        icon={TreeIcon}
        accent="bg-pink"
        title="allocation"
        body="shares are stored in basis points and capped at 10000 on-chain"
      />

      <div className="mt-5">
        <ShareBar segments={heirSegments(heirs)} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatBox
          label="allocated"
          value={bpsToPercent(allocated)}
          sub={`${allocated} bps`}
        />
        <StatBox
          label="unallocated"
          value={bpsToPercent(unallocated)}
          sub={`${unallocated} bps`}
          accent={unallocated > 0 ? "bg-yellow" : "bg-surface"}
        />
        <StatBox
          label="heirs"
          value={String(heirs.length)}
          sub="subnames minted"
        />
      </div>

      {unallocated > 0 ? (
        <AlertNote className="mt-4">
          the unallocated remainder stays in the vault after every heir claims. leave it
          deliberately, or hand it to someone.
        </AlertNote>
      ) : null}
    </section>
  );
}
