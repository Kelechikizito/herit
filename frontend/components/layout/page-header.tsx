import { Star } from "@/components/ui/deco";

/**
 * The heading every app screen opens with: an eyebrow, the title, an optional line of context,
 * and a decorative star pinned to the top-left corner the way DESIGN.md wants.
 */
export function PageHeader({
  eyebrow,
  title,
  /** Renders the title in the mono face — used when the title is an ENS name. */
  mono = false,
  description,
  starFill = "#FFE566",
  starRotate = -16,
  level = 1,
  children,
}: {
  eyebrow: string;
  title: string;
  mono?: boolean;
  description?: React.ReactNode;
  starFill?: string;
  starRotate?: number;
  /** 2 for a section heading under the page's own header, e.g. the estate chosen from a table. */
  level?: 1 | 2;
  /** Trailing content, floated opposite the title — the dashboard's status pill. */
  children?: React.ReactNode;
}) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <header className="relative">
      <Star
        className="-left-2 -top-3 hidden sm:block"
        size={26}
        fill={starFill}
        rotate={starRotate}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold tracking-wide text-muted">{eyebrow}</p>
          <Heading
            className={`mt-1 font-extrabold ${
              level === 1 ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
            } ${mono ? "mono" : ""}`}
          >
            {title}
          </Heading>
          {description ? (
            <div className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {description}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </header>
  );
}
