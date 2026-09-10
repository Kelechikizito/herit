import { HeirIcon } from "@/components/ui/icons";
import { type CircleSize, IconCircle } from "@/components/ui/icon-circle";
import { heirColor } from "@/lib/estate";

/** Glyph size per circle, so the icon keeps its optical weight as the avatar shrinks. */
const GLYPH: Record<CircleSize, number> = {
  "2xs": 10,
  xs: 12,
  sm: 13,
  md: 15,
  lg: 16,
  xl: 17,
};

/**
 * An heir's avatar. Coloured by position in the estate, not by list position, so the same person
 * keeps the same colour on the dashboard, the heir table, the vault split and the co-heir list.
 */
export function HeirAvatar({
  index,
  size = "xl",
}: {
  index: number;
  size?: CircleSize;
}) {
  return (
    <IconCircle size={size} accent={heirColor(index)}>
      <HeirIcon size={GLYPH[size]} />
    </IconCircle>
  );
}
