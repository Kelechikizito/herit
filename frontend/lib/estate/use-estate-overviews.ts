"use client";

import { isAddressEqual } from "viem";
import { useReadContracts } from "wagmi";
import { CHAIN_ID, NATIVE_TOKEN } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { EstateOverview, OwnedEstate } from "./types";
import { POLL_MS, toClock, toEstateStatus } from "./use-estate";

const NO_SHARES: readonly number[] = [];

/**
 * A summary of every estate in `estates`, in the order given, for the table a grantor chooses from.
 *
 * One multicall per question across all estates rather than the per-estate hooks, so the table
 * costs the same few reads however many estates the wallet holds.
 */
export function useEstateOverviews(estates: readonly OwnedEstate[]): Load<EstateOverview[]> {
  const some = estates.length > 0;

  const records = useReadContracts({
    allowFailure: false,
    contracts: estates.map(
      ({ estateId }) =>
        ({
          ...contracts.heritRegistry,
          functionName: "estateOf",
          args: [estateId],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, refetchInterval: POLL_MS },
  });
  const heirLists = useReadContracts({
    allowFailure: false,
    contracts: estates.map(
      ({ estateId }) =>
        ({
          ...contracts.heritRegistry,
          functionName: "heirsOf",
          args: [estateId],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, refetchInterval: POLL_MS },
  });
  const tokenLists = useReadContracts({
    allowFailure: false,
    contracts: estates.map(
      ({ estateId }) =>
        ({
          ...contracts.heritVault,
          functionName: "tokensOf",
          args: [estateId],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, refetchInterval: POLL_MS },
  });
  const ethBalances = useReadContracts({
    allowFailure: false,
    contracts: estates.map(
      ({ estateId }) =>
        ({
          ...contracts.heritVault,
          functionName: "balanceOf",
          args: [estateId, NATIVE_TOKEN],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, refetchInterval: POLL_MS },
  });

  // Every (estate, heir) pair, estate-major. A default share is written once, with its heir.
  const heirsOf = heirLists.data;
  const pairs =
    heirsOf === undefined
      ? []
      : estates.flatMap(({ estateId }, i) =>
          (heirsOf[i] ?? []).map((heirLabelhash) => ({ estateId, heirLabelhash })),
        );
  const shares = useReadContracts({
    allowFailure: false,
    contracts: pairs.map(
      ({ estateId, heirLabelhash }) =>
        ({
          ...contracts.heritRegistry,
          functionName: "defaultShareOf",
          args: [estateId, heirLabelhash],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: pairs.length > 0, staleTime: Infinity },
  });

  const failed = failedLoad(records, heirLists, tokenLists, ethBalances, shares);
  if (failed) return failed;
  if (!some) return ready([]);

  const recordOf = records.data;
  const tokensOf = tokenLists.data;
  const ethOf = ethBalances.data;
  if (recordOf === undefined || heirsOf === undefined || tokensOf === undefined || ethOf === undefined) {
    return LOADING;
  }
  if (pairs.length > 0 && shares.data === undefined) return LOADING;
  const shareOf = shares.data ?? NO_SHARES;

  const overviews: EstateOverview[] = [];
  let pair = 0;
  estates.forEach((estate, i) => {
    const heirCount = heirsOf[i].length;
    let allocatedBps = 0;
    for (let j = 0; j < heirCount; j++) allocatedBps += shareOf[pair++];

    overviews.push({
      ...estate,
      status: toEstateStatus(recordOf[i].status),
      clock: toClock(recordOf[i]),
      heirCount,
      allocatedBps,
      ethBalance: ethOf[i],
      erc20Count: tokensOf[i].filter((token) => !isAddressEqual(token, NATIVE_TOKEN)).length,
    });
  });
  return ready(overviews);
}
