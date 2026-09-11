import { HeirRow } from "@/components/estate/heir-row";
import { ClaimChip, RoleChip } from "@/components/estate/role-chip";
import { RecordField } from "@/components/ui/data-row";
import { PanelCard, PanelEmpty, PanelList } from "@/components/ui/panel-card";
import { type Heir, shortAddress } from "@/lib/estate";

/**
 * Every registered heir, with the records written under their subname.
 *
 * No remove button: heirs are append-only in `HeritRegistry`, and a control that cannot work is
 * worse than none.
 */
export function HeirTable({ estateLabel, heirs }: { estateLabel: string; heirs: readonly Heir[] }) {
  return (
    <PanelCard
      title="registered heirs"
      subtitle="resolver records written under each subname"
    >
      {heirs.length === 0 ? (
        <PanelEmpty>no heirs registered yet. name the first one with the form.</PanelEmpty>
      ) : (
        <PanelList>
          {heirs.map((heir, index) => (
            <li key={heir.label} className="px-6 py-5">
              <HeirRow estateLabel={estateLabel} heir={heir} index={index}>
                <RoleChip heir={heir} />
                <ClaimChip heir={heir} />
              </HeirRow>

              <HeirRecords heir={heir} />
            </li>
          ))}
        </PanelList>
      )}
    </PanelCard>
  );
}

/**
 * The records `AccessControlGate._writeHeirRecords` writes for every heir. The address and share
 * are read from `HeritRegistry`, which those records mirror; the relationship only exists as a
 * record.
 */
function HeirRecords({ heir }: { heir: Heir }) {
  return (
    <dl className="mt-4 grid gap-2 rounded-[8px] border-2 border-ink bg-cream px-4 py-3 sm:grid-cols-3">
      <RecordField label="addr(60)" value={shortAddress(heir.address)} />
      <RecordField label="herit.relationship" value={heir.relationship ?? "—"} />
      <RecordField label="herit.share" value={String(heir.shareBps)} />
    </dl>
  );
}
