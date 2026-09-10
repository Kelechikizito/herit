"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/wagmi/use-wallet";
import { WalletPicker } from "./wallet-picker";

/**
 * A call to action that collects a wallet before it lets you through.
 */
export function ConnectCta({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isConnected, isReconnecting } = useWallet();
  const [armed, setArmed] = useState(false);

  const pickerOpen = armed && !isReconnecting && !isConnected;

  useEffect(() => {
    if (!armed || isReconnecting || !isConnected) return;
    router.push(href);
  }, [armed, isReconnecting, isConnected, href, router]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (isConnected || isModifiedClick(event)) return;
      event.preventDefault();
      setArmed(true);
    },
    [isConnected],
  );

  return (
    <>
      <Link href={href} className={className} onClick={handleClick}>
        {children}
      </Link>
      <WalletPicker open={pickerOpen} onClose={() => setArmed(false)} />
    </>
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
