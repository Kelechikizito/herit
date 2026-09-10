"use client";

import { useReadContract } from "wagmi";
import { contracts } from "@/lib/contracts/contracts";
import type { EstateStatus } from "./types";

const STATUS_BY_INDEX = ["active", "grace", "unlocked"] as const satisfies readonly EstateStatus[];

function toEstateStatus(value: number): EstateStatus {
  const status = STATUS_BY_INDEX[value];
  if (status === undefined) {
    throw new Error(`HeritRegistry returned an unknown Status: ${value}`);
  }
  return status;
}

/** Roughly a Sepolia block. Fast enough for the demo, slow enough not to hammer the RPC. */
const POLL_MS = 12_000;

const enabledFor = (estateId: bigint | undefined) => estateId !== undefined;

/** `HeritRegistry.statusOf`*/
export function useEstateStatus(estateId: bigint | undefined) {
  const query = useReadContract({
    ...contracts.heritRegistry,
    functionName: "statusOf",
    args: estateId === undefined ? undefined : [estateId],
    query: { enabled: enabledFor(estateId), refetchInterval: POLL_MS },
  });

  return {
    ...query,
    estateStatus: query.data === undefined ? undefined : toEstateStatus(query.data),
  };
}

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
