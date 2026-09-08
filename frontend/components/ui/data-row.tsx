/**
 * Label/value pairs, in the three shapes the screens use.
 *
 * `DataRow` splits them across a line inside a `<dl>` — the dashboard, the setup review and the
 * claim card all read this way. `RecordField` stacks them, for dense grids of resolver records.
 * `FieldRow` is the same split, in plain spans, for the places that are not a description list.
 */

export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="mono font-bold">{value}</dd>
    </div>
  );
}

export function RecordField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold text-muted">{label}</dt>
      <dd className="mono truncate text-[0.78rem] font-bold">{value}</dd>
    </div>
  );
}

export function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[0.7rem] font-bold text-muted">{label}</span>
      <span className="mono truncate text-[0.75rem] font-bold">{value}</span>
    </div>
  );
}
