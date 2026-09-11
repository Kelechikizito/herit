import Link from "next/link";
import { ShareBar, heirSegments } from "@/components/estate/share-bar";
import { StatBox } from "@/components/ui/stat-box";
import {
  BPS_DENOMINATOR,
  type Estate,
  type Heir,
  type Vault,
  allocatedBps,
  bpsToPercent,
  estateHref,
  formatDuration,
  formatTokenAmount,
} from "@/lib/estate";

/** The estate at a glance. */
export function EstateSummaryCard({
  estate,
  heirs,
  vault,
}: {
  estate: Estate;
  heirs: readonly Heir[];
  vault: Vault;
}) {
  const allocated = allocatedBps(heirs);

  return (
    <section className="card p-6">
      <h2 className="text-xl">the estate</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatBox label="heirs named" value={String(heirs.length)} sub="ENS subnames" />
        <StatBox
          label="allocated"
          value={bpsToPercent(allocated)}
          sub={`${allocated} / ${BPS_DENOMINATOR} bps`}
        />
        <StatBox label="in vault" {...vaultStat(vault)} />
        <StatBox
          label="check-in every"
          value={formatDuration(estate.clock.checkInInterval)}
          sub={`+ ${formatDuration(estate.clock.graceDuration)} grace`}
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[0.72rem] font-bold tracking-wide text-muted">
            share allocation
          </p>
          <Link
            href={estateHref("/heirs", estate.label)}
            className="text-xs font-bold underline decoration-2 underline-offset-4"
          >
            edit heirs
          </Link>
        </div>
        <ShareBar segments={heirSegments(heirs)} />
      </div>
    </section>
  );
}

/** The first asset with a balance as the figure, the rest counted underneath. */
function vaultStat(vault: Vault): { value: string; sub: string } {
  const held = vault.tokens.filter((token) => token.balance > BigInt(0));
  const first = held[0];
  if (first === undefined) return { value: "empty", sub: "nothing escrowed yet" };

  return {
    value: formatTokenAmount(first.balance, first),
    sub: held.length > 1 ? `+ ${held.length - 1} more in HeritVault` : "HeritVault escrow",
  };
}
