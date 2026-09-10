import { CardHeading } from "@/components/ui/card-heading";
import { DataRow } from "@/components/ui/data-row";
import { Blob } from "@/components/ui/deco";
import { FormField } from "@/components/ui/form-field";
import { VaultIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import { SETUP_DEFAULTS, SETUP_REVIEW } from "@/lib/content/setup";

/** Step four: the deposit, the review, and the caveat about what stays unallocated. */
export function FundStep() {
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

      <FormField
        id="vault-amount"
        label="initial deposit (ETH)"
        hint="you can top the vault up at any time from the dashboard."
        className="mt-7 max-w-xs"
      >
        <input
          id="vault-amount"
          className="input mono"
          type="number"
          min={0}
          step={0.1}
          defaultValue={SETUP_DEFAULTS.depositEth}
        />
      </FormField>

      <div className="mt-8 rounded-[10px] border-2 border-ink bg-cream p-5">
        <h3 className="mb-4">review</h3>
        <dl className="space-y-2.5 text-sm">
          {SETUP_REVIEW.map((row) => (
            <DataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      </div>

      <AlertNote className="mt-4">
        10% of the vault is unallocated and will stay escrowed after every heir claims. that
        is allowed — just make sure it is deliberate.
      </AlertNote>
    </div>
  );
}
