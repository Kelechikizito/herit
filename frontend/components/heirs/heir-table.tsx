import { HeirRow } from "@/components/estate/heir-row";
import { RoleChip } from "@/components/estate/role-chip";
import { RecordField } from "@/components/ui/data-row";
import { TrashIcon } from "@/components/ui/icons";
import { PanelCard, PanelList } from "@/components/ui/panel-card";
import { type Estate, type Heir, shortAddress } from "@/lib/estate";

/** Every registered heir, with the resolver records written under their subname. */
export function HeirTable({ estate }: { estate: Estate }) {
  return (
    <PanelCard
      title="registered heirs"
      subtitle="resolver records written under each subname"
    >
      <PanelList>
        {estate.heirs.map((heir, index) => (
          <li key={heir.label} className="px-6 py-5">
            <HeirRow estate={estate} heir={heir} index={index}>
              <RoleChip status={estate.status} claimed={heir.claimed} />
              <ReleaseButton label={heir.label} />
            </HeirRow>

            <HeirRecords heir={heir} />
          </li>
        ))}
      </PanelList>
    </PanelCard>
  );
}

/** The records `AccessControlGate._writeHeirRecords` writes for every heir. */
function HeirRecords({ heir }: { heir: Heir }) {
  return (
    <dl className="mt-4 grid gap-2 rounded-[8px] border-2 border-ink bg-cream px-4 py-3 sm:grid-cols-3">
      <RecordField label="addr(60)" value={shortAddress(heir.address)} />
      <RecordField label="herit.relationship" value={heir.relationship} />
      <RecordField label="herit.share" value={String(heir.shareBps)} />
    </dl>
  );
}

function ReleaseButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-ink bg-surface transition-colors hover:bg-coral hover:text-white"
      aria-label={`release the ${label} heir slot`}
    >
      <TrashIcon size={15} />
    </button>
  );
}
