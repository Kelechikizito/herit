/**
 * A labelled field: the label, the control, and an optional hint under it.
 *
 * The control is passed in rather than generated, because the forms mix text, number and mono
 * inputs — the wrapper only owns the label/hint scaffolding and the `htmlFor` wiring.
 */
export function FormField({
  id,
  label,
  hint,
  /** Renders the hint in the mono face — used when it previews a name. */
  hintMono = false,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  hintMono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <p className={`hint ${hintMono ? "mono" : ""}`}>{hint}</p> : null}
    </div>
  );
}
