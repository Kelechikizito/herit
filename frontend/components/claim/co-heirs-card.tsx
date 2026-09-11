import { HeirAvatar } from "@/components/estate/heir-avatar";
import { ClaimChip, RoleChip, ShareChip } from "@/components/estate/role-chip";
import { Blob } from "@/components/ui/deco";
import { PanelCard, PanelEmpty, PanelList } from "@/components/ui/panel-card";
import { type Heir, bpsToPercent, coHeirs, fullName } from "@/lib/estate";

/** The other heirs named under the same estate, and where each of their claims stands. */
export function CoHeirsCard({
  estateLabel,
  heirs,
  heirLabel,
}: {
  estateLabel: string;
  heirs: readonly Heir[];
  heirLabel: string;
}) {
  const estate = { label: estateLabel };
  const others = coHeirs(heirs, heirLabel);

  return (
    <PanelCard
      title="co-heirs"
      subtitle={`the others named under ${fullName(estate)}`}
      decoration={<Blob className="-left-6 -top-6" size={58} fill="#F9A8B8" />}
    >
      {others.length === 0 ? (
        <PanelEmpty>no one else is named under this estate.</PanelEmpty>
      ) : (
        <PanelList>
          {others.map(({ heir, index }) => (
            <li key={heir.label} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <HeirAvatar index={index} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="mono truncate text-sm font-bold">{fullName(estate, heir.label)}</p>
                <p className="text-xs text-muted">{heir.relationship ?? "—"}</p>
              </div>
              <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
              <RoleChip heir={heir} />
              <ClaimChip heir={heir} />
            </li>
          ))}
        </PanelList>
      )}
    </PanelCard>
  );
}
