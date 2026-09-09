"use client";

import { useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, WalletIcon } from "@/components/ui/icons";
import { sepolia } from "@/lib/wagmi/chains";
import { useWallet } from "@/lib/wagmi/use-wallet";
import { WalletPicker } from "./wallet-picker";

export function ConnectWallet() {
  const { status, isWrongNetwork } = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (status === "reconnecting") {
    return (
      <span className="tag tag-shadow bg-cream" aria-live="polite">
        <WalletIcon size={14} />
        <span className="mono">reconnecting…</span>
      </span>
    );
  }

  if (status !== "connected") {
    return (
      <>
        <button type="button" className="btn btn-sm" onClick={() => setPickerOpen(true)}>
          <WalletIcon size={14} />
          connect wallet
        </button>
        <WalletPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    );
  }

  return isWrongNetwork ? <WrongNetwork /> : <ConnectedPill />;
}

function WrongNetwork() {
  const { switchToSepolia, isSwitching } = useWallet();

  return (
    <button
      type="button"
      className="btn btn-yellow btn-sm"
      onClick={switchToSepolia}
      disabled={isSwitching}
    >
      <AlertIcon size={14} />
      {isSwitching ? "switching…" : `switch to ${sepolia.name.toLowerCase()}`}
    </button>
  );
}

function ConnectedPill() {
  const { address, label, ensName, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        className="tag tag-shadow bg-teal transition-transform hover:translate-y-[1px]"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <WalletIcon size={14} />
        <span className="mono">{label}</span>
      </button>

      {open && address ? (
        <div
          className="card absolute right-0 top-[calc(100%+10px)] w-60 p-3"
          role="menu"
          aria-label="wallet"
        >
          {/* The pill shows the ENS name when there is one, so the menu shows the hex the name
              resolves to. */}
          {ensName ? (
            <p className="mono px-1 pb-2 text-[0.7rem] text-muted">{address}</p>
          ) : null}

          <CopyAddress address={address} />

          <a
            href={`${sepolia.blockExplorers.default.url}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="menu-row"
            role="menuitem"
          >
            view on {sepolia.blockExplorers.default.name.toLowerCase()}
          </a>

          <button
            type="button"
            className="menu-row text-coral"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="menu-row"
      role="menuitem"
      onClick={() => {
        void navigator.clipboard.writeText(address).then(() => setCopied(true));
      }}
    >
      {copied ? (
        <>
          <CheckIcon size={14} /> copied
        </>
      ) : (
        "copy address"
      )}
    </button>
  );
}
