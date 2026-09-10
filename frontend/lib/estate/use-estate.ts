"use client";

import { useReadContracts } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { Estate, EstateStatus } from "./types";

const STATUS_BY_INDEX = ["active", "grace", "unlocked"] as const satisfies readonly EstateStatus[];

function toEstateStatus(value: number): EstateStatus {
  const status = STATUS_BY_INDEX[value];
  if (status === undefined) {
    throw new Error(`HeritRegistry returned an unknown Status: ${value}`);
  }
  return status;
}

/** Roughly a Sepolia block. Fast enough for the demo, slow enough not to hammer the RPC. */
export const POLL_MS = 12_000;

/**
 * One estate's timers, status, registry and grantor, in a single multicall.
 *
 * `estateOf` already carries the pending status, so there is no separate `statusOf` read. Nor a
 * `deadlinesOf` one: it runs the same sum over these timers that `windowEndsAt` and `unlockAt` do.
 */
export function useEstate(estateId: bigint, label: string): Load<Estate> {
  const query = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...contracts.heritRegistry, functionName: "estateOf", args: [estateId], chainId: CHAIN_ID },
      {
        ...contracts.accessControlGate,
        functionName: "estateRegistryOf",
        args: [estateId],
        chainId: CHAIN_ID,
      },
      { ...contracts.grantorRegistry, functionName: "getOwner", args: [estateId], chainId: CHAIN_ID },
    ],
    query: { refetchInterval: POLL_MS },
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;

  const [record, estateRegistry, grantor] = query.data;
  return ready({
    estateId,
    label,
    grantor,
    estateRegistry,
    status: toEstateStatus(record.status),
    clock: {
      lastCheckIn: Number(record.lastCheckIn),
      checkInInterval: Number(record.checkInInterval),
      graceDuration: Number(record.graceDuration),
    },
  });
}
