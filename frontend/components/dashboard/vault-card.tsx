import { HeirAvatar } from "@/components/estate/heir-avatar";
import { CardHeading } from "@/components/ui/card-heading";
import { Blob } from "@/components/ui/deco";
import { PlusIcon, VaultIcon } from "@/components/ui/icons";
import { type Estate, shareOfVault } from "@/lib/estate";

/** What is escrowed, and how it splits on unlock. */
export function VaultCard({ estate }: { estate: Estate }) {
  return (
    <section className="card relative h-fit overflow-hidden p-6">
      <Blob className="-right-6 -top-6" size={64} fill="#4ECDC4" />

      <div className="relative z-10">
        <CardHeading
          icon={VaultIcon}
          accent="bg-teal"
          title="vault"
          body="opt-in escrow, not your whole wallet"
        />

        <p className="mono mt-6 text-4xl font-extrabold">{estate.vaultEth} ETH</p>
        <p className="mt-1 text-xs text-muted">
          split {estate.heirs.length} ways on unlock
        </p>

        <ul className="mt-5 space-y-2 border-t-2 border-ink pt-5">
          {estate.heirs.map((heir, index) => (
            <li key={heir.label} className="flex items-center gap-2.5">
              <HeirAvatar index={index} size="xs" />
              <span className="mono flex-1 truncate text-xs font-bold">{heir.label}</span>
              <span className="mono text-xs font-bold">
                {shareOfVault(estate.vaultEth, heir.shareBps).toFixed(2)} ETH
              </span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-ghost btn-sm mt-5 w-full">
          <PlusIcon size={15} />
          deposit
        </button>
      </div>
    </section>
  );
}
