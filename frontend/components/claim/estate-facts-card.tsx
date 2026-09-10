import { isAddressEqual, zeroAddress } from "viem";
import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { DotTrail } from "@/components/ui/deco";
import { ShieldIcon, TreeIcon } from "@/components/ui/icons";
import {
  type Estate,
  type Vault,
  formatStamp,
  formatTokenAmount,
  fullName,
  shortAddress,
  unlockAt,
} from "@/lib/estate";

/** What the heir is inheriting from. */
export function EstateFactsCard({ estate, vault }: { estate: Estate; vault: Vault }) {
  const balances =
    vault.tokens.length === 0
      ? "empty"
      : vault.tokens.map((token) => formatTokenAmount(token.balance, token)).join(" · ");

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
        <DataRow
          label="grantor"
          // Registry A reads zero for a lapsed name.
          value={isAddressEqual(estate.grantor, zeroAddress) ? "name lapsed" : shortAddress(estate.grantor)}
        />
        <DataRow label="estate registry" value={shortAddress(estate.estateRegistry)} />
        <DataRow label="last selfie check" value={formatStamp(estate.clock.lastCheckIn)} />
        <DataRow
          label={estate.status === "unlocked" ? "unlocked at" : "unlocks at"}
          value={formatStamp(unlockAt(estate.clock))}
        />
        <DataRow label="vault balance" value={balances} />
      </dl>

      <div className="relative z-10 mt-6 flex items-start gap-2.5 rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
        <ShieldIcon size={18} />
        <p className="text-xs leading-relaxed text-muted">
          the unlock is a pure function of the clock, and anyone
          could poke the registry to trigger it.
        </p>
      </div>
    </section>
  );
}
