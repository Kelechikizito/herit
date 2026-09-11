import { AlertIcon } from "@/components/ui/icons";
import { describeError } from "@/lib/contracts/errors";
import type { Load } from "@/lib/estate";

/**
 * A card's data, or the card-shaped placeholder standing in for it.
 *
 * Cards take ready data only. Loading and read failures are drawn here, the same way on every
 * screen, and nothing falls back to sample data while a read is outstanding.
 */
export function Loaded<T>({
  load,
  title,
  className = "",
  children,
}: {
  load: Load<T>;
  /** The title of the card this stands in for, so the layout does not jump when it arrives. */
  title: string;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  if (load.status === "ready") return <>{children(load.data)}</>;

  return (
    <section className={`card p-6 ${className}`} aria-busy={load.status === "loading"}>
      <h2 className="text-xl">{title}</h2>

      {load.status === "loading" ? (
        <p className="mt-2 text-sm text-muted">reading sepolia…</p>
      ) : (
        <>
          <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted">
            <AlertIcon size={16} />
            {describeError(load.error)}
          </p>
          <button type="button" className="btn btn-sm mt-4" onClick={load.retry}>
            try again
          </button>
        </>
      )}
    </section>
  );
}
