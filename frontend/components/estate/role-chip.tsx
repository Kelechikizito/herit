import { LockIcon, UnlockIcon } from "@/components/ui/icons";
import type { EstateStatus } from "@/lib/estate";

/**
 * The state of `ROLE_HEIR_CLAIM` on one heir subname — the bit that is the inheritance. Withheld
 * at registration, granted on unlock, spent on claim.
 */
export function RoleChip({ status, claimed }: { status: EstateStatus; claimed: boolean }) {
  if (claimed) {
    return <span className="tag bg-teal px-2.5 py-0.5 text-[0.7rem]">claimed</span>;
  }

  if (status === "unlocked") {
    return (
      <span className="tag bg-coral px-2.5 py-0.5 text-[0.7rem] text-white">
        <UnlockIcon size={12} />
        claimable
      </span>
    );
  }

  return (
    <span className="tag bg-surface px-2.5 py-0.5 text-[0.7rem]">
      <LockIcon size={12} />
      dormant
    </span>
  );
}

/** An heir's share of the estate, as a chip. */
export function ShareChip({ children }: { children: React.ReactNode }) {
  return <span className="tag bg-cream px-2.5 py-0.5 text-[0.7rem]">{children}</span>;
}
