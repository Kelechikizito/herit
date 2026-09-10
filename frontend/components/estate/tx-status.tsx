import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { type TxState, explorerTxUrl, pendingLabel } from "@/lib/wagmi/use-transaction";

/**
 * One line under a button: what its transaction is doing, what went wrong, or that it landed.
 * Renders nothing while idle, so a form does not reserve space for it.
 */
export function TxStatus({
  tx,
  success = "confirmed on sepolia",
  className = "",
}: {
  tx: TxState;
  success?: string;
  className?: string;
}) {
  if (tx.phase === "idle") return null;

  const link = tx.hash ? (
    <a
      href={explorerTxUrl(tx.hash)}
      target="_blank"
      rel="noreferrer"
      className="font-bold underline decoration-2 underline-offset-4"
    >
      view tx
    </a>
  ) : null;

  if (tx.phase === "error") {
    return (
      <p className={`flex items-start gap-2 text-xs leading-relaxed text-coral ${className}`} role="alert">
        <AlertIcon size={15} />
        <span>
          {tx.error} {link}
        </span>
      </p>
    );
  }

  if (tx.phase === "success") {
    return (
      <p className={`flex items-start gap-2 text-xs leading-relaxed ${className}`} role="status">
        <CheckIcon size={15} />
        <span>
          {success} {link}
        </span>
      </p>
    );
  }

  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`} role="status">
      {pendingLabel(tx.phase)} {link}
    </p>
  );
}
