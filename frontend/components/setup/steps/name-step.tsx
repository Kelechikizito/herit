import { CardHeading } from "@/components/ui/card-heading";
import { FormField } from "@/components/ui/form-field";
import { CheckIcon, TreeIcon } from "@/components/ui/icons";
import { NAME_STEP_FACTS, SETUP_DEFAULTS } from "@/lib/content/setup";

/** Step one: claim the estate name and deploy its registry. */
export function NameStep() {
  const name = `${SETUP_DEFAULTS.estateLabel}.herit.eth`;

  return (
    <div>
      <CardHeading
        size="lg"
        icon={TreeIcon}
        accent="bg-lavender"
        title="claim your estate name"
        body="this registers your label in herit's grantor registry and deploys a dedicated ENSv2 registry for your estate in the same transaction. herit holds only the root roles it needs to gate heirs — it cannot sell, delete, or swap your name."
      />

      <FormField
        id="estate-label"
        label="estate label"
        hint={name}
        hintMono
        className="mt-7 max-w-md"
      >
        <input
          id="estate-label"
          className="input"
          defaultValue={SETUP_DEFAULTS.estateLabel}
          autoComplete="off"
        />
      </FormField>

      <p className="mt-4 inline-flex items-center gap-2 rounded-[8px] border-2 border-ink bg-teal px-3.5 py-2.5 text-xs font-bold">
        <CheckIcon size={15} />
        {name} is available
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {NAME_STEP_FACTS.map((fact) => (
          <li key={fact.title} className="card-flat p-4">
            <h3 className="text-sm">{fact.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{fact.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
