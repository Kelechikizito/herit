"use client";

import { useCallback } from "react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useEnsName,
  useSwitchChain,
} from "wagmi";
import type { Connector } from "wagmi";
import { shortAddress } from "@/lib/estate";
import { sepolia } from "./chains";


export function useWallet() {
  const connection = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending: isConnecting, error: connectError, reset } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain();

  const { address, chainId, status } = connection;

  const { data: ensName } = useEnsName({
    address,
    chainId: sepolia.id,
    query: { enabled: address !== undefined },
  });

  const isWrongNetwork = status === "connected" && chainId !== sepolia.id;

  return {
    connectors,
    address,
    chainId,
    status,
    /** Only ever true once the wallet has actually handed over an account. */
    isConnected: connection.isConnected,
    /** Restoring a prior session from the cookie. */
    isReconnecting: connection.isReconnecting,
    isConnecting,
    isSwitching,
    isWrongNetwork,
    connectError,
    /** ENS name when one reverse-resolves, otherwise the truncated hex. Never an empty label. */
    label: ensName ?? (address ? shortAddress(address) : undefined),
    ensName: ensName ?? undefined,
    connect: useCallback(
      (connector: Connector) => connect({ connector }),
      [connect],
    ),
    disconnect: useCallback(() => disconnect(), [disconnect]),
    switchToSepolia: useCallback(() => switchChain({ chainId: sepolia.id }), [switchChain]),
    /** Clears a rejected-connection error so a reopened picker doesn't show a stale message. */
    resetConnectError: reset,
  };
}
