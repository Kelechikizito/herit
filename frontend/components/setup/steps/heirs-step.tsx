import { HeirAvatar } from "@/components/estate/heir-avatar";
import { ShareChip } from "@/components/estate/role-chip";
import { ShareBar, heirSegments } from "@/components/estate/share-bar";
import { CardHeading } from "@/components/ui/card-heading";
import { FormField } from "@/components/ui/form-field";
import { HeirIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { bpsToPercent, fullName } from "@/lib/estate";
import { SAMPLE_ESTATE } from "@/lib/fixtures/estate";

/** Step three: the heir list being drafted, and the form that appends to it. */
export function HeirsStep() {
  const estate = SAMPLE_ESTATE;

  return (
    <div>
      <CardHeading
        size="lg"
        icon={HeirIcon}
        accent="bg-pink"
        title="name your next-of-kin"
        body="each heir gets a subname inside your estate registry with a relationship record and a share. the claim role is withheld at registration — that withheld bit is the whole inheritance."
      />

      <div className="mt-7">
        <ShareBar segments={heirSegments(estate)} />

        <ul className="mt-4 space-y-2">
          {estate.heirs.map((heir, index) => (
            <li
              key={heir.label}
              className="card-flat flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <HeirAvatar index={index} size="md" />
              <div className="min-w-[10rem] flex-1">
                <p className="mono text-sm font-bold">{fullName(estate, heir.label)}</p>
                <p className="text-xs text-muted">{heir.relationship}</p>
              </div>
              <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-ink bg-surface hover:bg-coral hover:text-white"
                aria-label={`remove ${heir.label}`}
              >
                <TrashIcon size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <DraftHeirForm />
    </div>
  );
}

/** The inline draft form. Dashed border — nothing here is minted until the wizard finishes. */
function DraftHeirForm() {
  return (
    <div className="mt-7 rounded-[10px] border-2 border-dashed border-ink p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="draft-label" label="subname label">
          <input id="draft-label" className="input" placeholder="son" autoComplete="off" />
        </FormField>

        <FormField id="draft-relationship" label="relationship">
          <input
            id="draft-relationship"
            className="input"
            placeholder="son"
            autoComplete="off"
          />
        </FormField>

        <FormField
          id="draft-address"
          label="controlling address"
          className="sm:col-span-2"
        >
          <input
            id="draft-address"
            className="input mono"
            placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>

        <FormField id="draft-share" label="share %">
          <input
            id="draft-share"
            className="input mono"
            type="number"
            min={0}
            max={100}
            step={0.5}
            defaultValue={25}
          />
        </FormField>

        <div className="flex items-end">
          <button type="button" className="btn w-full">
            <PlusIcon size={16} />
            add heir
          </button>
        </div>
      </div>
    </div>
  );
}
