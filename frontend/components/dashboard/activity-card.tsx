import { PanelCard, PanelList } from "@/components/ui/panel-card";
import { type Estate, LOG_COLOR } from "@/lib/estate";

/** The event feed. Every state change herit emits, newest first. */
export function ActivityCard({ estate }: { estate: Estate }) {
  return (
    <PanelCard title="activity" subtitle="every state change herit emits as an event">
      <PanelList>
        {estate.log.map((entry) => (
          <li key={entry.id} className="flex gap-3 px-6 py-3.5">
            <span
              className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 border-ink ${LOG_COLOR[entry.kind]}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed">{entry.text}</p>
              <p className="mono mt-0.5 text-[0.7rem] text-muted">{entry.stamp}</p>
            </div>
          </li>
        ))}
      </PanelList>
    </PanelCard>
  );
}
