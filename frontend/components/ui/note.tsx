import { AlertIcon } from "./icons";

/** A quiet caveat under a card — the things that are allowed but should be deliberate. */
export function AlertNote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`flex items-start gap-2 text-xs leading-relaxed text-muted ${className}`}>
      <AlertIcon size={15} />
      {children}
    </p>
  );
}
