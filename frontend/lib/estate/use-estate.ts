"use client";

import { useReadContract } from "wagmi";
import {
  HERIT_REGISTRY_ADDRESS,
  heritRegistryAbi,
  toEstateStatus,
} from "@/lib/contracts/herit-registry";
import type { EstateClock } from "./types";


/** Roughly a Sepolia block. Fast enough for the demo, slow enough not to hammer the RPC. */
const POLL_MS = 12_000;

const enabledFor = (estateId: bigint | undefined) =>
  HERIT_REGISTRY_ADDRESS !== undefined && estateId !== undefined;

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

/** `HeritRegistry.estateOf` */
export function useEstateClock(estateId: bigint | undefined) {
  const query = useReadContract({
    abi: heritRegistryAbi,
    address: HERIT_REGISTRY_ADDRESS,
    functionName: "estateOf",
    args: estateId === undefined ? undefined : [estateId],
    query: { enabled: enabledFor(estateId), refetchInterval: POLL_MS },
  });

  const clock: EstateClock | undefined =
    query.data === undefined
      ? undefined
      : {
          // uint64 seconds. Safe in a JS number until the year 285428751.
          lastCheckIn: Number(query.data.lastCheckIn),
          checkInInterval: Number(query.data.checkInInterval),
          graceDuration: Number(query.data.graceDuration),
          storedStatus: toEstateStatus(query.data.status),
        };

  return { ...query, clock };
}

/* Both reads together, for the dashboard.*/
export function useEstate(estateId: bigint | undefined) {
  const status = useEstateStatus(estateId);
  const clock = useEstateClock(estateId);

  return {
    status: status.estateStatus,
    clock: clock.clock,
    isPending: status.isPending || clock.isPending,
    error: status.error ?? clock.error,
    refetch: () => {
      void status.refetch();
      void clock.refetch();
    },
  };
}
