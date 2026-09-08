import { CardHeading } from "@/components/ui/card-heading";
import { Sparkle } from "@/components/ui/deco";
import { FormField } from "@/components/ui/form-field";
import { PlusIcon } from "@/components/ui/icons";
import { BPS_DENOMINATOR, type Estate, unallocatedBps } from "@/lib/estate";

/** The form that mints one more subname under the estate, with its claim role withheld. */
export function AddHeirForm({ estate }: { estate: Estate }) {
  const unallocated = unallocatedBps(estate);

  return (
    <section className="card relative overflow-hidden p-6 lg:sticky lg:top-24">
      <Sparkle className="right-5 top-5" size={22} fill="#FFE566" rotate={-10} />

      <CardHeading
        icon={PlusIcon}
        accent="bg-lavender"
        title="name an heir"
        body="mints a subname with the claim role withheld"
      />

      <form className="mt-6 space-y-4">
        <FormField
          id="heir-label"
          label="subname label"
          hint={`daughter.${estate.label}.herit.eth`}
          hintMono
        >
          <input
            id="heir-label"
            className="input"
            placeholder="daughter"
            autoComplete="off"
          />
        </FormField>

        <FormField
          id="heir-address"
          label="controlling address"
          hint="written as the addr(60) record, and given ROLE_HEIR_CLAIM on unlock."
        >
          <input
            id="heir-address"
            className="input mono"
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="heir-relationship" label="relationship">
            <input
              id="heir-relationship"
              className="input"
              placeholder="daughter"
              autoComplete="off"
            />
          </FormField>
          <FormField id="heir-share" label="share %">
            <input
              id="heir-share"
              className="input mono"
              type="number"
              min={0}
              max={100}
              step={0.5}
              defaultValue={10}
            />
          </FormField>
        </div>

        <div className="rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
          <BudgetRow label="still unallocated" value={`${unallocated} bps`} />
          <BudgetRow label="cap" value={`${BPS_DENOMINATOR} bps`} className="mt-1" />
        </div>

        <button type="button" className="btn w-full">
          <PlusIcon size={16} />
          register heir
        </button>
      </form>
    </section>
  );
}

function BudgetRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between text-xs ${className}`}>
      <span className="font-bold text-muted">{label}</span>
      <span className="mono font-bold">{value}</span>
    </div>
  );
}
