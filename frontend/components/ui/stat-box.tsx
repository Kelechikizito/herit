/** A labelled figure in a bordered box. Flat by default; shadows stay selective. */
export function StatBox({
  label,
  value,
  sub,
  accent = "bg-surface",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className={`card-flat px-4 py-3.5 ${accent}`}>
      <p className="text-[0.72rem] font-bold tracking-wide text-muted">{label}</p>
      <p className="mono mt-1 text-lg font-extrabold leading-tight sm:text-xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
