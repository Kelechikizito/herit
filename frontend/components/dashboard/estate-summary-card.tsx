import Link from "next/link";
import { ShareBar, heirSegments } from "@/components/estate/share-bar";
import { StatBox } from "@/components/ui/stat-box";
import {
  BPS_DENOMINATOR,
  type Estate,
  allocatedBps,
  bpsToPercent,
} from "@/lib/estate";

/** The estate at a glance: four figures and the share allocation bar. */
export function EstateSummaryCard({ estate }: { estate: Estate }) {
  const allocated = allocatedBps(estate);

  return (
    <section className="card p-6">
      <h2 className="text-xl">the estate</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatBox
          label="heirs named"
          value={String(estate.heirs.length)}
          sub="ENS subnames"
        />
        <StatBox
          label="allocated"
          value={bpsToPercent(allocated)}
          sub={`${allocated} / ${BPS_DENOMINATOR} bps`}
        />
        <StatBox label="in vault" value={`${estate.vaultEth} ETH`} sub="HeritVault escrow" />
        <StatBox
          label="check-in every"
          value={estate.checkInInterval}
          sub={`+ ${estate.graceDuration} grace`}
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[0.72rem] font-bold tracking-wide text-muted">
            share allocation
          </p>
          <Link
            href="/heirs"
            className="text-xs font-bold underline decoration-2 underline-offset-4"
          >
            edit heirs
          </Link>
        </div>
        <ShareBar segments={heirSegments(estate)} />
      </div>
    </section>
  );
}
