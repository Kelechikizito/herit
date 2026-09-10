"use client";

import { LockIcon, UnlockIcon } from "@/components/ui/icons";
import { type Heir, claimProgress } from "@/lib/estate";
import { useChange } from "@/lib/estate/use-change";

/**
 * The state of `ROLE_HEIR_CLAIM` on one heir subname — the bit that is the inheritance. Withheld
 * at registration, granted on unlock, and kept after claiming: `ClaimManager` never revokes it.
 *
 * Read from ENS through `canClaim`, not inferred from the clock. An estate whose grace has lapsed
 * but that nobody has poked still shows dormant here. Deliberately separate from claim progress:
 * the first claim runs the unlock itself, and a chip that jumped straight to "claimed" would hide
 * the grant that just happened. When the flip lands while the chip is on screen, it pops.
 */
export function RoleChip({ heir }: { heir: Pick<Heir, "canClaim"> }) {
  const change = useChange(heir.canClaim);

  if (heir.canClaim) {
    return (
      <span
        key={change?.seq}
        className={`tag bg-coral px-2.5 py-0.5 text-[0.7rem] text-white ${change ? "flash-change" : ""}`}
        title="ROLE_HEIR_CLAIM is granted on this subname"
      >
        <UnlockIcon size={12} />
        role granted
      </span>
    );
  }

  return (
    <span
      className="tag bg-surface px-2.5 py-0.5 text-[0.7rem]"
      title="ROLE_HEIR_CLAIM stays withheld until the estate unlocks"
    >
      <LockIcon size={12} />
      dormant
    </span>
  );
}

/** How far an heir is through their claim, from `hasClaimed`. Nothing until the first payout. */
export function ClaimChip({ heir }: { heir: Pick<Heir, "holdings"> }) {
  const { paid, of } = claimProgress(heir.holdings);
  const change = useChange(paid);

  if (paid === 0) return null;

  return (
    <span
      key={change?.seq}
      className={`tag bg-teal px-2.5 py-0.5 text-[0.7rem] ${change ? "flash-change" : ""}`}
    >
      {paid === of ? "claimed" : `${paid}/${of} claimed`}
    </span>
  );
}

/** An heir's share of the estate, as a chip. */
export function ShareChip({ children }: { children: React.ReactNode }) {
  return <span className="tag bg-cream px-2.5 py-0.5 text-[0.7rem]">{children}</span>;
}
