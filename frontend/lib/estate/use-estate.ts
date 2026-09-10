"use client";

import { useReadContract } from "wagmi";
import { heritRegistryAbi } from "@/lib/contracts/abis/heritRegistry.abi";
import { herit } from "@/lib/contracts/addresses";
import type { EstateStatus } from "./types";

const STATUS_BY_INDEX = ["active", "grace", "unlocked"] as const satisfies readonly EstateStatus[];

function toEstateStatus(value: number): EstateStatus {
  const status = STATUS_BY_INDEX[value];
  if (status === undefined) {
    throw new Error(`HeritRegistry returned an unknown Status: ${value}`);
  }
  return status;
}

const HERIT_REGISTRY_ADDRESS = herit.heritRegistry;

/** Roughly a Sepolia block. Fast enough for the demo, slow enough not to hammer the RPC. */
const POLL_MS = 12_000;

const enabledFor = (estateId: bigint | undefined) => estateId !== undefined;

/** `HeritRegistry.statusOf`*/
export function useEstateStatus(estateId: bigint | undefined) {
  const query = useReadContract({
    abi: heritRegistryAbi,
    address: HERIT_REGISTRY_ADDRESS,
    functionName: "statusOf",
    args: estateId === undefined ? undefined : [estateId],
    query: { enabled: enabledFor(estateId), refetchInterval: POLL_MS },
  });

  return {
    ...query,
    estateStatus: query.data === undefined ? undefined : toEstateStatus(query.data),
  };
}

/**
 * There is no on-chain getter for `lastCheckIn`/`checkInInterval`/`graceDuration` today —
 * `HeritRegistry` only exposes `statusOf`. Per ARCHITECTURE.md §6.4, the clock fields a dashboard
 * needs ("days until check-in due") are meant to come from the Ponder/ENSNode-style indexer
 * rather than a direct contract read; there is no `useEstateClock` here until that exists (or a
 * getter is added to the contract).
 */
export function useEstate(estateId: bigint | undefined) {
  const status = useEstateStatus(estateId);

  return {
    status: status.estateStatus,
    isPending: status.isPending,
    error: status.error,
    refetch: () => {
      void status.refetch();
    },
  };
}
