import Link from "next/link";
import { HeirRow } from "@/components/estate/heir-row";
import { RoleChip } from "@/components/estate/role-chip";
import { PlusIcon } from "@/components/ui/icons";
import { PanelCard, PanelEmpty, PanelList } from "@/components/ui/panel-card";
import { type Heir, estateHref } from "@/lib/estate";

/** The heir list, read-only here; editing lives on `/heirs`. */
export function HeirsCard({ estateLabel, heirs }: { estateLabel: string; heirs: readonly Heir[] }) {
  return (
    <PanelCard
      title="heirs"
      action={
        <Link href={estateHref("/heirs", estateLabel)} className="btn btn-ghost btn-sm">
          <PlusIcon size={15} />
          add
        </Link>
      }
    >
      {heirs.length === 0 ? (
        <PanelEmpty>no heirs named yet. until one is, this estate has nobody to unlock to.</PanelEmpty>
      ) : (
        <PanelList>
          {heirs.map((heir, index) => (
            <li key={heir.label} className="px-6 py-4">
              <HeirRow estateLabel={estateLabel} heir={heir} index={index}>
                <RoleChip heir={heir} />
              </HeirRow>
            </li>
          ))}
        </PanelList>
      )}
    </PanelCard>
  );
}
