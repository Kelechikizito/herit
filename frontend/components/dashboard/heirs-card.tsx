import Link from "next/link";
import { HeirRow } from "@/components/estate/heir-row";
import { RoleChip } from "@/components/estate/role-chip";
import { PlusIcon } from "@/components/ui/icons";
import { PanelCard, PanelList } from "@/components/ui/panel-card";
import type { Estate } from "@/lib/estate";

/** The heir list, read-only here — editing lives on `/heirs`. */
export function HeirsCard({ estate }: { estate: Estate }) {
  return (
    <PanelCard
      title="heirs"
      action={
        <Link href="/heirs" className="btn btn-ghost btn-sm">
          <PlusIcon size={15} />
          add
        </Link>
      }
    >
      <PanelList>
        {estate.heirs.map((heir, index) => (
          <li key={heir.label} className="px-6 py-4">
            <HeirRow estate={estate} heir={heir} index={index}>
              <RoleChip status={estate.status} claimed={heir.claimed} />
            </HeirRow>
          </li>
        ))}
      </PanelList>
    </PanelCard>
  );
}
