"use client";

import { useReadContracts } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { countdownTarget, nowSeconds } from "./format";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { Estate, EstateClock, EstateStatus } from "./types";

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

/** How often to read once the clock has passed a deadline the returned status has not caught up to. */
const OVERDUE_POLL_MS = 3_000;

/** `estateOf` as viem decodes it. */
type EstateRecord = {
  lastCheckIn: bigint;
  checkInInterval: bigint;
  graceDuration: bigint;
  status: number;
};

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
    query: { refetchInterval: (current) => nextPollMs(current.state.data?.[0]) },
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
    clock: toClock(record),
  });
}

function toClock(record: EstateRecord): EstateClock {
  return {
    lastCheckIn: Number(record.lastCheckIn),
    checkInInterval: Number(record.checkInInterval),
    graceDuration: Number(record.graceDuration),
  };
}

/**
 * When to read the estate again, recomputed after every read.
 *
 * The status moves on block time. No transaction lands, so nothing invalidates, and a flat poll
 * would leave the ring at zero for up to a whole interval after a deadline. So: just past the next
 * deadline when it falls inside the normal poll, then every few seconds until `estateOf` agrees it
 * has passed — the first block stamped after a deadline can trail the wall clock by a block.
 */
function nextPollMs(record: EstateRecord | undefined): number {
  const status = record === undefined ? undefined : STATUS_BY_INDEX[record.status];
  if (record === undefined || status === undefined) return POLL_MS;

  // Null once unlocked, and before the first check-in: no deadline to wait on.
  const deadline = countdownTarget(status, toClock(record));
  if (deadline === null) return POLL_MS;

  const untilMs = (deadline - nowSeconds()) * 1000;
  return untilMs <= 0 ? OVERDUE_POLL_MS : Math.min(POLL_MS, untilMs + 1_000);
}
