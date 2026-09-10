"use client";

import type { Address } from "viem";
import { ClaimCard } from "@/components/claim/claim-card";
import { CoHeirsCard } from "@/components/claim/co-heirs-card";
import { EstateFactsCard } from "@/components/claim/estate-facts-card";
import { UnlockBanner } from "@/components/claim/unlock-banner";
import { Loaded } from "@/components/estate/card-state";
import { EntrySwitcher } from "@/components/estate/entry-switcher";
import { SelectionNotice } from "@/components/estate/selection-notice";
import { PageHeader } from "@/components/layout/page-header";
import { type Heir, type HeirSlot, type Load, all, fullName, heirSlotLink, ready } from "@/lib/estate";
import { useClaim } from "@/lib/estate/use-claim";
import { useSelectedHeirSlot } from "@/lib/estate/use-discovery";
import { useEstate } from "@/lib/estate/use-estate";
import { useHeirs } from "@/lib/estate/use-heirs";
import { useVault } from "@/lib/estate/use-vault";

export function ClaimView({
  now,
  requestedEstate,
  requestedHeir,
}: {
  now: number;
  requestedEstate?: string;
  requestedHeir?: string;
}) {
  const resolved = useSelectedHeirSlot({ estate: requestedEstate, heir: requestedHeir });

  if (resolved.kind !== "selected") {
    return (
      <SelectionNotice
        resolved={resolved}
        audience="heir"
        requested={requestedName(requestedEstate, requestedHeir)}
        toLink={heirSlotLink}
      />
    );
  }

  return (
    <Claim
      now={now}
      slot={resolved.selected}
      entries={resolved.entries}
      address={resolved.address}
    />
  );
}

/** One heir slot's claim. Split out so its reads only start once a slot is chosen. */
function Claim({
  now,
  slot,
  entries,
  address,
}: {
  now: number;
  slot: HeirSlot;
  entries: readonly HeirSlot[];
  address: Address;
}) {
  const estate = useEstate(slot.estateId, slot.estateLabel);
  const vault = useVault(slot.estateId);
  const heirs = useHeirs(slot.estateId, slot.estateLabel, vault);
  const claimable = useClaim(slot.estateId, slot.heirLabelhash);
  const heir = heirOf(heirs, slot);

  const estateName = fullName({ label: slot.estateLabel });
  const relationship = heir.status === "ready" ? heir.data.relationship : undefined;
  const granted = heir.status === "ready" && heir.data.canClaim;

  return (
    <>
      <PageHeader
        eyebrow="heir view"
        title={fullName({ label: slot.estateLabel }, slot.heirLabel)}
        mono
        starFill="#F9A8B8"
        starRotate={12}
        description={`you are named as ${relationship ?? "an heir"} under ${estateName}. ${
          granted
            ? "your claim role was granted when the estate unlocked."
            : "your claim role stays withheld until the grantor's grace period lapses."
        }`}
      />

      <EntrySwitcher label="your claims" links={entries.map(heirSlotLink)} current={heirSlotLink(slot)} />

      <Loaded load={all(estate, heir)} title="estate status" className="mt-6">
        {([estate, heir]) => <UnlockBanner estate={estate} canClaim={heir.canClaim} now={now} />}
      </Loaded>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <Loaded load={all(estate, heir, vault, claimable)} title="your share">
          {([estate, heir, vault, claimable]) => (
            <ClaimCard
              estate={estate}
              heir={heir}
              vault={vault}
              claimable={claimable}
              address={address}
            />
          )}
        </Loaded>

        <div className="space-y-6">
          <Loaded load={all(estate, vault)} title="the estate">
            {([estate, vault]) => <EstateFactsCard estate={estate} vault={vault} />}
          </Loaded>
          <Loaded load={heirs} title="co-heirs">
            {(heirs) => (
              <CoHeirsCard estateLabel={slot.estateLabel} heirs={heirs} heirLabel={slot.heirLabel} />
            )}
          </Loaded>
        </div>
      </div>
    </>
  );
}

/**
 * The slot's own row in the estate's heir list. `heirSlotsOf` and `heirsOf` are written by the same
 * `recordHeir` call, so a slot missing from the list means the chain disagrees with itself.
 */
function heirOf(heirs: Load<Heir[]>, slot: HeirSlot): Load<Heir> {
  if (heirs.status !== "ready") return heirs;

  const heir = heirs.data.find((candidate) => candidate.labelhash === slot.heirLabelhash);
  return heir === undefined
    ? {
        status: "error",
        error: new Error(`${slot.heirLabel} is not in this estate's heir list.`),
        retry: () => window.location.reload(),
      }
    : ready(heir);
}

/** The name the URL asked for, as specific as its params allow. */
function requestedName(estate?: string, heir?: string): string | undefined {
  if (estate === undefined) return heir;
  return heir === undefined ? `${estate}.herit.eth` : `${heir}.${estate}.herit.eth`;
}
