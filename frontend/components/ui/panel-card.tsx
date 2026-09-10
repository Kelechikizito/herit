/**
 * A card with a tinted header strip above a divided list — the shape the heir lists, the activity
 * feed and the co-heir list all share.
 */
export function PanelCard({
  title,
  subtitle,
  action,
  decoration,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  /** Trailing control in the header strip, e.g. an "add" button. */
  action?: React.ReactNode;
  /** Absolutely positioned deco, painted under the header. */
  decoration?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card relative overflow-hidden ${className}`}>
      {decoration}
      <div
        className={`relative z-10 border-b-2 border-ink bg-cream px-6 py-4 ${
          action ? "flex items-center justify-between gap-3" : ""
        }`}
      >
        <div>
          <h2 className="text-xl">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The divided list a `PanelCard` usually wraps. */
export function PanelList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y-2 divide-ink">{children}</ul>;
}
