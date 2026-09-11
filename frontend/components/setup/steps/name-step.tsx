import { CardHeading } from "@/components/ui/card-heading";
import { FormField } from "@/components/ui/form-field";
import { AlertIcon, CheckIcon, ClockIcon, TreeIcon } from "@/components/ui/icons";
import { NAME_STEP_FACTS } from "@/lib/content/setup";
import { describeError } from "@/lib/contracts/errors";
import { fullName, labelProblem, shortAddress } from "@/lib/estate";
import type { LabelCheck } from "@/lib/estate/use-setup";

/** Step one: claim the estate name and deploy its registry. */
export function NameStep({
  label,
  onLabel,
  check,
}: {
  label: string;
  onLabel: (label: string) => void;
  check: LabelCheck;
}) {
  const name = fullName({ label: label || "your-name" });

  return (
    <div>
      <CardHeading
        size="lg"
        icon={TreeIcon}
        accent="bg-lavender"
        title="claim your estate name"
        body="this registers your label in herit's grantor registry and deploys a dedicated ENSv2 registry for your estate in the same transaction. herit holds only the root roles it needs to gate heirs — it cannot sell, delete, or swap your name."
      />

      <FormField id="estate-label" label="estate label" hint={name} hintMono className="mt-7 max-w-md">
        <input
          id="estate-label"
          className="input"
          value={label}
          // Lowercased as typed: an uppercase label hashes to a different, unreachable name.
          onChange={(event) => onLabel(event.target.value.toLowerCase())}
          placeholder="alice"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>

      <LabelStatus label={label} name={name} check={check} />

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

const STATUS_BOX =
  "mt-4 inline-flex items-center gap-2 rounded-[8px] border-2 border-ink px-3.5 py-2.5 text-xs font-bold";

function LabelStatus({ label, name, check }: { label: string; name: string; check: LabelCheck }) {
  switch (check.kind) {
    case "invalid":
      return label === "" ? null : (
        <p className={`${STATUS_BOX} bg-surface`}>
          <AlertIcon size={15} />
          {labelProblem(label)}
        </p>
      );
    case "checking":
      return (
        <p className={`${STATUS_BOX} bg-surface`}>
          <ClockIcon size={15} />
          checking {name}…
        </p>
      );
    case "error":
      return (
        <p className={`${STATUS_BOX} bg-surface`}>
          <AlertIcon size={15} />
          {describeError(check.error)}
          <button type="button" className="underline decoration-2 underline-offset-4" onClick={check.retry}>
            retry
          </button>
        </p>
      );
    case "available":
      return (
        <div>
          <p className={`${STATUS_BOX} bg-teal`}>
            <CheckIcon size={15} />
            {name} is available
          </p>
          <p className="hint">
            its estate registry will deploy at{" "}
            <span className="mono font-bold" title={check.registry}>
              {shortAddress(check.registry)}
            </span>
          </p>
        </div>
      );
    case "yours":
      return (
        <p className={`${STATUS_BOX} bg-yellow`}>
          <CheckIcon size={15} />
          you already opened {name} — setup picks up where it stopped
        </p>
      );
    case "taken":
      return (
        <p className={`${STATUS_BOX} bg-coral text-white`}>
          <AlertIcon size={15} />
          {name} is taken
        </p>
      );
  }
}
