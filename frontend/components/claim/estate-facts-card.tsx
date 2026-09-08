import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { DotTrail } from "@/components/ui/deco";
import { ShieldIcon, TreeIcon } from "@/components/ui/icons";
import { type Estate, fullName, shortAddress } from "@/lib/estate";

/** What the heir is inheriting from, and the reminder that no one chose it. */
export function EstateFactsCard({ estate }: { estate: Estate }) {
  return (
    <section className="card relative overflow-hidden p-6">
      <DotTrail className="-right-2 bottom-4" size={80} fill="#C4B5FD" />

      <CardHeading
        icon={TreeIcon}
        accent="bg-lavender"
        title="the estate"
        body="what you are inheriting from"
      />

      <dl className="relative z-10 mt-6 space-y-2.5 text-sm">
        <DataRow label="grantor name" value={fullName(estate)} />
        <DataRow label="grantor" value={shortAddress(estate.grantor)} />
        <DataRow label="estate registry" value={shortAddress(estate.estateRegistry)} />
        <DataRow label="last selfie check" value={estate.lastCheckIn} />
        <DataRow label="unlocked at" value={estate.unlocksAt} />
        <DataRow label="vault balance" value={`${estate.vaultEth} ETH`} />
      </dl>

      <div className="relative z-10 mt-6 flex items-start gap-2.5 rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
        <ShieldIcon size={18} />
        <p className="text-xs leading-relaxed text-muted">
          herit never decided this. the unlock is a pure function of the clock, and anyone
          could have poked the registry to trigger it.
        </p>
      </div>
    </section>
  );
}
