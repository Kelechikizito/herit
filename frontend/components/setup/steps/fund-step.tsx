import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { Blob } from "@/components/ui/deco";
import { FormField } from "@/components/ui/form-field";
import { VaultIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import {
  BPS_DENOMINATOR,
  DEPOSIT_ASSETS,
  type DepositAsset,
  type SetupDraft,
  allocatedDraftBps,
  bpsToPercent,
  formatDuration,
  fullName,
} from "@/lib/estate";

const ASSETS = Object.keys(DEPOSIT_ASSETS) as DepositAsset[];

/** Step four: the deposit, the review, and the caveat about what stays unallocated. */
export function FundStep({
  draft,
  amountProblem,
  onAsset,
  onAmount,
}: {
  draft: SetupDraft;
  amountProblem: string | undefined;
  onAsset: (asset: DepositAsset) => void;
  onAmount: (amount: string) => void;
}) {
  const allocated = allocatedDraftBps(draft.heirs);
  const unallocated = BPS_DENOMINATOR - allocated;
  const asset = DEPOSIT_ASSETS[draft.deposit.asset];
  const amount = draft.deposit.amount.trim();

  const review: { label: string; value: string }[] = [
    { label: "estate name", value: draft.label ? fullName(draft) : "—" },
    { label: "check-in interval", value: formatDuration(draft.intervalSeconds) },
    { label: "grace period", value: formatDuration(draft.graceSeconds) },
    { label: "unlocks after", value: formatDuration(draft.intervalSeconds + draft.graceSeconds) },
    {
      label: "heirs",
      value: `${draft.heirs.length} ${draft.heirs.length === 1 ? "subname" : "subnames"}`,
    },
    { label: "allocated", value: bpsToPercent(allocated) },
    { label: "vault deposit", value: amount === "" ? "none yet" : `${amount} ${asset.name}` },
  ];

  return (
    <div className="relative">
      <Blob className="-right-4 -top-4" size={60} fill="#FFE566" />

      <CardHeading
        size="lg"
        icon={VaultIcon}
        accent="bg-yellow"
        title="fund the vault and start the clock"
        body="deposit exactly what you intend to will. herit escrows it in a purpose-built vault rather than taking a module over your whole wallet, so the custody boundary stays obvious."
      />

      <fieldset className="mt-7">
        <legend className="label">asset</legend>
        <div className="flex flex-wrap gap-3">
          {ASSETS.map((key) => {
            const active = draft.deposit.asset === key;
            return (
              <button
                key={key}
                type="button"
                className={`rounded-[8px] border-2 border-ink px-4 py-2.5 text-sm font-bold ${
                  active ? "bg-yellow shadow-brut" : "bg-surface"
                }`}
                aria-pressed={active}
                onClick={() => onAsset(key)}
              >
                {DEPOSIT_ASSETS[key].name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <FormField
        id="vault-amount"
        label={`initial deposit (${asset.name})`}
        hint={amountProblem ?? "optional. you can top the vault up at any time from the dashboard."}
        className="mt-5 max-w-xs"
      >
        <input
          id="vault-amount"
          className="input mono"
          inputMode="decimal"
          placeholder="0.0"
          value={draft.deposit.amount}
          onChange={(event) => onAmount(event.target.value)}
        />
      </FormField>

      <div className="mt-8 rounded-[10px] border-2 border-ink bg-cream p-5">
        <h3 className="mb-4">review</h3>
        <dl className="space-y-2.5 text-sm">
          {review.map((row) => (
            <DataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      </div>

      {draft.heirs.length === 0 ? (
        <AlertNote className="mt-4">
          no heirs are drafted. the estate can open without any, but until one is named there is
          nobody for it to unlock to.
        </AlertNote>
      ) : unallocated > 0 ? (
        <AlertNote className="mt-4">
          {bpsToPercent(unallocated)} of the vault is unallocated and will stay escrowed after every
          heir claims. that is allowed — just make sure it is deliberate.
        </AlertNote>
      ) : null}
    </div>
  );
}
