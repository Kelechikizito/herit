import { HeirAvatar } from "@/components/estate/heir-avatar";
import { CardHeading } from "@/components/ui/card-heading";
import { Blob } from "@/components/ui/deco";
import { PlusIcon, VaultIcon } from "@/components/ui/icons";
import {
  type Heir,
  type Vault,
  formatTokenAmount,
  holdingOf,
  shareBase,
  shareOfAmount,
} from "@/lib/estate";

/** What is escrowed, and how it splits on unlock. */
export function VaultCard({ heirs, vault }: { heirs: readonly Heir[]; vault: Vault }) {
  const [primary, ...others] = vault.tokens;

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

        {primary === undefined ? (
          <>
            <p className="mono mt-6 text-4xl font-extrabold">empty</p>
            <p className="mt-1 text-xs text-muted">nothing escrowed yet</p>
          </>
        ) : (
          <>
            <p className="mono mt-6 text-4xl font-extrabold">
              {formatTokenAmount(primary.balance, primary)}
            </p>
            {others.map((token) => (
              <p key={token.token} className="mono mt-1 text-lg font-extrabold">
                {formatTokenAmount(token.balance, token)}
              </p>
            ))}
            <p className="mt-1 text-xs text-muted">{splitNote(heirs.length, vault.snapshotTaken)}</p>

            {heirs.length > 0 ? (
              <ul className="mt-5 space-y-2 border-t-2 border-ink pt-5">
                {heirs.map((heir, index) => (
                  <li key={heir.label} className="flex items-center gap-2.5">
                    <HeirAvatar index={index} size="xs" />
                    <span className="mono flex-1 truncate text-xs font-bold">{heir.label}</span>
                    <span className="mono text-right text-xs font-bold">
                      {vault.tokens
                        .map((token) =>
                          formatTokenAmount(
                            shareOfAmount(
                              shareBase(vault, token),
                              holdingOf(heir, token.token)?.shareBps ?? 0,
                            ),
                            token,
                          ),
                        )
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        <button type="button" className="btn btn-ghost btn-sm mt-5 w-full">
          <PlusIcon size={15} />
          deposit
        </button>
      </div>
    </section>
  );
}

function splitNote(heirCount: number, snapshotTaken: boolean): string {
  if (heirCount === 0) return "no heirs to split it between yet";
  const ways = `split ${heirCount} ${heirCount === 1 ? "way" : "ways"}`;
  // Before the snapshot the split is measured against today's balance, which can still move.
  return snapshotTaken ? `${ways} off the unlock snapshot` : `${ways} on unlock · estimated from today's balance`;
}
