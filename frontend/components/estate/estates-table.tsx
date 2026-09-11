"use client";

import Link from "next/link";
import { Loaded } from "@/components/estate/card-state";
import { StatusPill } from "@/components/estate/status-pill";
import { PlusIcon } from "@/components/ui/icons";
import { PanelCard, PanelList } from "@/components/ui/panel-card";
import {
  type EstateOverview,
  type OwnedEstate,
  bpsToPercent,
  describeDeadline,
  estateHref,
  formatTokenAmount,
  fullName,
} from "@/lib/estate";
import { useEstateOverviews } from "@/lib/estate/use-estate-overviews";
import { useNow } from "@/lib/estate/use-now";

/** The id on the selected estate's section, so choosing a row brings it into view. */
export const ESTATE_DETAILS_ID = "estate-details";

const TITLE = "estates";

/** Shared by the header row and every estate row, so the columns line up. */
const COLUMNS =
  "sm:grid-cols-[minmax(0,1.5fr)_6.5rem_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)]";

/**
 * Every estate the wallet holds, newest first, as rows to choose from. Choosing is a navigation to
 * `?estate=<label>`, so the choice survives a reload and a shared link opens the same estate.
 */
export function EstatesTable({
  entries,
  selected,
  pathname,
  now,
}: {
  entries: readonly OwnedEstate[];
  selected: OwnedEstate;
  /** The screen each row opens the estate on. */
  pathname: "/dashboard" | "/heirs";
  now: number;
}) {
  const overviews = useEstateOverviews(entries);

  return (
    <Loaded load={overviews} title={TITLE} className="mt-8">
      {(overviews) => (
        <Table overviews={overviews} selected={selected} pathname={pathname} now={now} />
      )}
    </Loaded>
  );
}

function Table({
  overviews,
  selected,
  pathname,
  now,
}: {
  overviews: readonly EstateOverview[];
  selected: OwnedEstate;
  pathname: string;
  now: number;
}) {
  const tick = useNow(now);

  return (
    <PanelCard
      title={TITLE}
      subtitle={`${plural(overviews.length, "estate")}, newest first — choose one to open it below`}
      className="mt-8"
      action={
        <Link href="/setup" className="btn btn-ghost btn-sm">
          <PlusIcon size={15} />
          open another
        </Link>
      }
    >
      <div
        aria-hidden="true"
        className={`hidden gap-x-4 border-b-2 border-ink px-6 py-2.5 text-[0.7rem] font-bold tracking-wide text-muted sm:grid ${COLUMNS}`}
      >
        <span>estate</span>
        <span>status</span>
        <span>next deadline</span>
        <span>heirs</span>
        <span>vault</span>
      </div>

      <PanelList>
        {overviews.map((estate) => {
          const current = estate.estateId === selected.estateId;
          const deadline = describeDeadline(estate.status, estate.clock, tick);

          return (
            <li key={estate.label}>
              <Link
                href={`${estateHref(pathname, estate.label)}#${ESTATE_DETAILS_ID}`}
                aria-current={current ? "true" : undefined}
                className={`grid grid-cols-2 items-center gap-x-4 gap-y-3 px-6 py-3.5 transition-colors ${COLUMNS} ${
                  current ? "bg-yellow/40" : "hover:bg-cream focus-visible:bg-cream"
                }`}
              >
                <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                  <span className="mono truncate text-sm font-bold">{fullName(estate)}</span>
                  {current ? (
                    <span className="tag bg-yellow px-2 py-0 text-[0.65rem]">viewing</span>
                  ) : null}
                </span>
                <span>
                  <StatusPill status={estate.status} size="sm" />
                </span>
                <Cell main={deadline.main} sub={deadline.sub} mono />
                <Cell
                  main={plural(estate.heirCount, "heir")}
                  sub={`${bpsToPercent(estate.allocatedBps)} allocated`}
                />
                <Cell
                  main={
                    estate.ethBalance > BigInt(0)
                      ? formatTokenAmount(estate.ethBalance, { symbol: "ETH", decimals: 18 })
                      : "no ETH"
                  }
                  sub={estate.erc20Count > 0 ? `+ ${plural(estate.erc20Count, "ERC20")} listed` : "HeritVault"}
                />
              </Link>
            </li>
          );
        })}
      </PanelList>
    </PanelCard>
  );
}

function Cell({ main, sub, mono = false }: { main: string; sub: string; mono?: boolean }) {
  return (
    <span className="min-w-0">
      <span className={`block truncate text-sm font-bold ${mono ? "mono" : ""}`}>{main}</span>
      <span className="block truncate text-[0.7rem] text-muted">{sub}</span>
    </span>
  );
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
