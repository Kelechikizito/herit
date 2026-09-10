import { HeirAvatar } from "@/components/estate/heir-avatar";
import { RoleChip, ShareChip } from "@/components/estate/role-chip";
import { Blob } from "@/components/ui/deco";
import { PanelCard, PanelList } from "@/components/ui/panel-card";
import { type Estate, bpsToPercent, coHeirs, fullName } from "@/lib/estate";

/** The other heirs named under the same estate, and where each of their claims stands. */
export function CoHeirsCard({
  estate,
  heirLabel,
}: {
  estate: Estate;
  heirLabel: string;
}) {
  return (
    <PanelCard
      title="co-heirs"
      subtitle={`the others named under ${fullName(estate)}`}
      decoration={<Blob className="-left-6 -top-6" size={58} fill="#F9A8B8" />}
    >
      <PanelList>
        {coHeirs(estate, heirLabel).map(({ heir, index }) => (
          <li key={heir.label} className="flex items-center gap-3 px-6 py-4">
            <HeirAvatar index={index} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="mono truncate text-sm font-bold">
                {fullName(estate, heir.label)}
              </p>
              <p className="text-xs text-muted">{heir.relationship}</p>
            </div>
            <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
            <RoleChip status={estate.status} claimed={heir.claimed} />
          </li>
        ))}
      </PanelList>
    </PanelCard>
  );
}
