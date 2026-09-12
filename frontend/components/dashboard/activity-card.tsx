import { Loaded } from "@/components/estate/card-state";
import { PanelCard, PanelEmpty, PanelList } from "@/components/ui/panel-card";
import { LOG_COLOR, type Load, formatStamp } from "@/lib/estate";
import {
  type ActivityContext,
  type EstateActivity,
  describeActivity,
} from "@/lib/subgraph/activity";
import { SUBGRAPH_URL } from "@/lib/subgraph/client";

const TITLE = "activity";

/** The event feed, indexed by the herit subgraph. Every state change herit emits, newest first. */
export function ActivityCard({
  activity,
  context,
}: {
  activity: Load<EstateActivity>;
  context: ActivityContext;
}) {
  if (SUBGRAPH_URL === undefined) {
    return (
      <PanelCard title={TITLE} subtitle="every state change herit emits as an event">
        <PanelEmpty>
          the event feed is not connected. set <span className="mono">NEXT_PUBLIC_SUBGRAPH_URL</span>{" "}
          to the herit subgraph&apos;s query url from subgraph studio.
        </PanelEmpty>
      </PanelCard>
    );
  }

  return (
    <Loaded load={activity} title={TITLE}>
      {(activity) => <Feed activity={activity} context={context} />}
    </Loaded>
  );
}

function Feed({ activity, context }: { activity: EstateActivity; context: ActivityContext }) {
  const entries = describeActivity(activity.records, context);
  const subtitle = activity.hasIndexingErrors
    ? "the indexer hit an error — this feed may be behind the chain"
    : `indexed by The Graph through block ${activity.indexedBlock.toLocaleString("en-US")}`;

  return (
    <PanelCard title={TITLE} subtitle={subtitle}>
      {entries.length === 0 ? (
        <PanelEmpty>
          no events indexed for this estate yet. check-ins, deposits and claims appear here a few
          seconds after they land.
        </PanelEmpty>
      ) : (
        <PanelList>
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 px-6 py-3.5">
              <span
                className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 border-ink ${LOG_COLOR[entry.kind]}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{entry.text}</p>
                <p className="mono mt-0.5 text-[0.7rem] text-muted">
                  {entry.href ? (
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {formatStamp(entry.stamp)}
                    </a>
                  ) : (
                    formatStamp(entry.stamp)
                  )}
                </p>
              </div>
            </li>
          ))}
        </PanelList>
      )}
    </PanelCard>
  );
}
