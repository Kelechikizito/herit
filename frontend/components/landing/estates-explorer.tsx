"use client";

import { useState } from "react";
import { Loaded } from "@/components/estate/card-state";
import { HeirAvatar } from "@/components/estate/heir-avatar";
import { ShareChip } from "@/components/estate/role-chip";
import { StatusPill } from "@/components/estate/status-pill";
import { Blob, Star } from "@/components/ui/deco";
import { ChevronDownIcon } from "@/components/ui/icons";
import { PanelCard, PanelEmpty, PanelList } from "@/components/ui/panel-card";
import { Reveal } from "@/components/ui/reveal";
import { StatBox } from "@/components/ui/stat-box";
import {
  type EstateOverview,
  type EstateStatus,
  bpsToPercent,
  describeDeadline,
  formatAgo,
  formatStamp,
  formatTokenAmount,
  fullName,
  nowSeconds,
  shortAddress,
} from "@/lib/estate";
import { useAllEstates } from "@/lib/estate/use-all-estates";
import { useEstateOverviews } from "@/lib/estate/use-estate-overviews";
import { type RosterHeir, useHeirRoster } from "@/lib/estate/use-heir-roster";
import { useNow } from "@/lib/estate/use-now";
import type { AllEstates, OpenedEstate } from "@/lib/subgraph/estates";
import { SUBGRAPH_URL } from "@/lib/subgraph/client";
import { explorerAddressUrl } from "@/lib/wagmi/use-transaction";

/**
 * Every estate on this deployment, for anyone — no wallet, no ownership.
 *
 * Two sources, each doing what only it can. The subgraph answers "which estates exist and who
 * opened them", which no contract can be asked: `estatesOfGrantor` is per wallet. The chain answers
 * everything that moves — status, timers, heirs, shares, balances — because an indexed copy of a
 * countdown goes stale the moment a block is mined. So rows are discovered from the indexer and
 * filled in from Sepolia, and nothing here is a cached judgement about whether an estate has lapsed.
 */

const TITLE = "live estates";

/** Shared by the header row and every estate row, so the columns line up. */
const COLUMNS =
  "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_6.5rem_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]";

export function EstatesExplorer() {
  return (
    <section id="estates" className="relative scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6">
      <Star className="left-[5%] top-[10%]" size={34} fill="#4ECDC4" rotate={-8} />
      <Blob className="-right-8 bottom-[18%]" size={76} fill="#FFE566" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-teal">live on sepolia</span>
          <h2 className="mt-5 max-w-2xl">every estate opened so far</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            not a screenshot. each row is read from the herit contracts as you look at it — who
            opened the estate, where its clock stands, and which ENS subnames are waiting on it.
            open a row to see the heirs and their shares.
          </p>
        </Reveal>

        <Explorer />
      </div>
    </section>
  );
}

function Explorer() {
  const estates = useAllEstates();

  // The indexer is the only way to enumerate estates, so an unset URL is a missing feature rather
  // than a failed read — said plainly, the way the activity feed says it.
  if (SUBGRAPH_URL === undefined) {
    return (
      <PanelCard title={TITLE} subtitle="every estate herit has opened" className="mt-10">
        <PanelEmpty>
          the estate index is not connected. set{" "}
          <span className="mono">NEXT_PUBLIC_SUBGRAPH_URL</span> to the herit subgraph&apos;s query
          url from subgraph studio.
        </PanelEmpty>
      </PanelCard>
    );
  }

  return (
    <Loaded load={estates} title={TITLE} className="mt-10">
      {(estates) => <Rows indexed={estates} />}
    </Loaded>
  );
}

/** One row's worth: what the indexer recorded at opening, plus what the chain says right now. */
type ExplorerRow = EstateOverview & Pick<OpenedEstate, "grantor" | "estateRegistry" | "openedAt">;

function Rows({ indexed }: { indexed: AllEstates }) {
  // `useEstateOverviews` takes any list of estates, not the connected wallet's — one multicall per
  // question across all of them, so the cost is the same few reads however long this list gets.
  const overviews = useEstateOverviews(indexed.estates);

  const subtitle = indexed.hasIndexingErrors
    ? "the indexer hit an error — this list may be missing recent estates"
    : `indexed by the graph through block ${indexed.indexedBlock.toLocaleString("en-US")} · live values read from sepolia`;

  if (indexed.estates.length === 0) {
    return (
      <PanelCard title={TITLE} subtitle={subtitle} className="mt-10">
        <PanelEmpty>
          no estates opened on this deployment yet. the first one to run through setup appears here
          a few seconds after it lands.
        </PanelEmpty>
      </PanelCard>
    );
  }

  return (
    <Loaded load={overviews} title={TITLE} className="mt-10">
      {(overviews) => (
        <Table
          // Index-aligned: `useEstateOverviews` answers in the order it was asked.
          rows={overviews.map((overview, i) => ({
            ...overview,
            grantor: indexed.estates[i].grantor,
            estateRegistry: indexed.estates[i].estateRegistry,
            openedAt: indexed.estates[i].openedAt,
          }))}
          subtitle={subtitle}
        />
      )}
    </Loaded>
  );
}

function Table({ rows, subtitle }: { rows: readonly ExplorerRow[]; subtitle: string }) {
  // Safe to seed from the wall clock: this only renders once the reads above have resolved, which
  // never happens during the server render, so there is no snapshot for hydration to disagree with.
  const now = useNow(nowSeconds());
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <Totals rows={rows} />

      <PanelCard title={TITLE} subtitle={subtitle} className="mt-6">
        <div
          aria-hidden="true"
          className={`hidden gap-x-4 border-b-2 border-ink px-6 py-2.5 text-[0.7rem] font-bold tracking-wide text-muted sm:grid ${COLUMNS}`}
        >
          <span>estate</span>
          <span>opened by</span>
          <span>status</span>
          <span>next deadline</span>
          <span>heirs</span>
          <span>vault</span>
        </div>

        <PanelList>
          {rows.map((row) => {
            const expanded = open === row.label;
            const panelId = `estate-${row.label}`;
            const deadline = describeDeadline(row.status, row.clock, now);

            return (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : row.label)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className={`grid w-full grid-cols-2 items-center gap-x-4 gap-y-3 px-6 py-3.5 text-left transition-colors ${COLUMNS} ${
                    expanded ? "bg-cream" : "hover:bg-cream focus-visible:bg-cream"
                  }`}
                >
                  <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <ChevronDownIcon
                      size={15}
                      className={`flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                    <span className="min-w-0">
                      <span className="mono block truncate text-sm font-bold">{fullName(row)}</span>
                      <span className="block truncate text-[0.7rem] text-muted">
                        opened {formatAgo(Math.max(0, now - row.openedAt))}
                      </span>
                    </span>
                  </span>

                  <span className="mono min-w-0 truncate text-sm font-bold">
                    {shortAddress(row.grantor)}
                  </span>

                  <span>
                    <StatusPill status={row.status} size="sm" />
                  </span>

                  <Cell main={deadline.main} sub={deadline.sub} mono />
                  <Cell
                    main={plural(row.heirCount, "heir")}
                    sub={`${bpsToPercent(row.allocatedBps)} allocated`}
                  />
                  <Cell
                    main={
                      row.ethBalance > BigInt(0)
                        ? formatTokenAmount(row.ethBalance, { symbol: "ETH", decimals: 18 })
                        : "no ETH"
                    }
                    sub={
                      row.erc20Count > 0 ? `+ ${plural(row.erc20Count, "ERC20")} listed` : "HeritVault"
                    }
                  />
                </button>

                {expanded ? <Detail id={panelId} row={row} /> : null}
              </li>
            );
          })}
        </PanelList>
      </PanelCard>
    </>
  );
}

/** What the deployment adds up to, for the judge who reads one line and moves on. */
function Totals({ rows }: { rows: readonly ExplorerRow[] }) {
  const heirs = rows.reduce((total, row) => total + row.heirCount, 0);
  const escrowed = rows.reduce((total, row) => total + row.ethBalance, BigInt(0));
  const count = (status: EstateStatus) => rows.filter((row) => row.status === status).length;
  const unlocked = count("unlocked");

  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatBox
        label="estates opened"
        value={String(rows.length)}
        sub={`${count("active")} active · ${count("grace")} in grace`}
        accent="bg-lavender"
      />
      <StatBox label="heirs named" value={String(heirs)} sub="ENS subnames minted" accent="bg-pink" />
      <StatBox
        label="escrowed"
        value={formatTokenAmount(escrowed, { symbol: "ETH", decimals: 18 })}
        sub="held by HeritVault"
        accent="bg-teal"
      />
      <StatBox
        label="handed over"
        value={String(unlocked)}
        sub={unlocked === 0 ? "no estate has lapsed" : "claim role granted"}
        accent={unlocked > 0 ? "bg-coral" : "bg-surface"}
      />
    </div>
  );
}

/** The open row: who inherits what, and the two addresses that prove the rest of the claim. */
function Detail({ id, row }: { id: string; row: ExplorerRow }) {
  const roster = useHeirRoster(row.estateId);

  return (
    <div id={id} className="border-t-2 border-dashed border-ink/25 bg-cream px-6 py-5">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-[0.72rem] font-bold tracking-wide text-muted">heirs and shares</p>

          {roster.status === "loading" ? (
            <p className="mt-2 text-sm text-muted">reading sepolia…</p>
          ) : roster.status === "error" ? (
            <p className="mt-2 text-sm text-muted">the heir list could not be read just now.</p>
          ) : roster.data.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              no heirs registered yet — the grantor has opened the name but not named anyone.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {roster.data.map((heir, index) => (
                <HeirRow key={heir.label} estateLabel={row.label} heir={heir} index={index} />
              ))}
            </ul>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <Fact label="opened by">
            <ExplorerLink address={row.grantor} />
          </Fact>
          <Fact label="estate registry">
            <ExplorerLink address={row.estateRegistry} />
          </Fact>
          <Fact label="opened">
            <span className="mono">{formatStamp(row.openedAt)} UTC</span>
          </Fact>
        </dl>
      </div>
    </div>
  );
}

function HeirRow({
  estateLabel,
  heir,
  index,
}: {
  estateLabel: string;
  heir: RosterHeir;
  index: number;
}) {
  return (
    <li className="card-flat flex items-center gap-3 px-3 py-2.5">
      <HeirAvatar index={index} size="md" />
      <div className="min-w-0 flex-1">
        <p className="mono truncate text-[0.78rem] font-bold">{fullName({ label: estateLabel }, heir.label)}</p>
        <p className="mono truncate text-[0.68rem] text-muted">{shortAddress(heir.address)}</p>
      </div>
      <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.72rem] font-bold tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function ExplorerLink({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="mono text-[0.8rem] font-bold underline-offset-2 hover:underline"
    >
      {shortAddress(address)}
    </a>
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
