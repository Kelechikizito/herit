"use client";

import { useEffect } from "react";
import type { Connector } from "wagmi";
import { Star } from "@/components/ui/deco";
import { AlertIcon, WalletIcon } from "@/components/ui/icons";
import { useWallet } from "@/lib/wagmi/use-wallet";

/**
 * wagmi sets this on the error instance. Matched as a literal rather than via
 * `ProviderNotFoundError.name`, which reads the static class name and is mangled by the production
 * minifier — the check would then quietly stop matching in the deployed build only.
 */
const NO_PROVIDER = "ProviderNotFoundError";

/**
 * The connector picker.
 *
 * The list is `useConnectors()`, not a hardcoded set of wallet names: EIP-6963 discovery means each
 * browser wallet announces itself with its own name and icon, so this renders whatever is actually
 * installed rather than offering options that will fail.
 */
export function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <WalletPickerDialog onClose={onClose} />;
}

function WalletPickerDialog({ onClose }: { onClose: () => void }) {
  const { connectors, connect, isConnecting, isConnected, connectError, resetConnectError } =
    useWallet();

  // Close as soon as the wallet hands over an account. Callers that need to do something on
  // success watch `isConnected` themselves, so there is no success callback to thread through.
  useEffect(() => {
    if (isConnected) onClose();
  }, [isConnected, onClose]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // A stale "user rejected" from a previous attempt shouldn't outlive the dialog.
  useEffect(() => resetConnectError, [resetConnectError]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="connect a wallet"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
        <Star className="-left-4 -top-4 z-20" size={34} fill="#7B6CF6" rotate={-14} />

        <div className="card max-h-[88vh] overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <span className="icon-box bg-teal">
              <WalletIcon size={22} />
            </span>
            <div>
              <h2 className="text-xl">connect a wallet</h2>
              <p className="mt-1 text-sm text-muted">
                herit reads and writes on Sepolia — the only chain ENSv2 is deployed to.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-2.5">
            {connectors.map((connector) => (
              <li key={connector.uid}>
                <ConnectorButton
                  connector={connector}
                  disabled={isConnecting}
                  onSelect={() => connect(connector)}
                />
              </li>
            ))}
          </ul>

          {connectError ? (
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-[8px] border-2 border-ink px-4 py-3 ${
                isNoProvider(connectError) ? "bg-yellow" : "bg-pink"
              }`}
              role="alert"
            >
              <AlertIcon size={18} />
              <p className="text-xs font-medium leading-relaxed">
                {friendlyConnectError(connectError)}
              </p>
            </div>
          ) : null}

          <button type="button" className="btn btn-ghost mt-5 w-full" onClick={onClose}>
            cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectorButton({
  connector,
  disabled,
  onSelect,
}: {
  connector: Connector;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="card-flat flex w-full items-center gap-3 px-4 py-3 text-left transition-transform hover:translate-x-[2px] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-cream">
        {connector.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connector.icon} alt="" className="h-full w-full object-cover" />
        ) : (
          <WalletIcon size={14} />
        )}
      </span>
      <span className="text-sm font-bold">{connector.name}</span>
    </button>
  );
}

/**
 * Whether the click landed on a connector with no wallet behind it.
 */
function isNoProvider(error: { name: string }): boolean {
  return (error.name as string) === NO_PROVIDER;
}

function friendlyConnectError(error: { name: string; message: string }): string {
  if (isNoProvider(error)) {
    return "no browser wallet found. install one — MetaMask, Rabby, or any EIP-6963 wallet — then reload this page.";
  }
  if (/rejected|denied/i.test(error.message)) {
    return "connection cancelled in the wallet.";
  }
  // Provider errors arrive as a headline plus a details block; only the headline is readable.
  return error.message.split("\n")[0] ?? "the wallet could not connect.";
}
