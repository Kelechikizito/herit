"use client";

import type { Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { LOADING, type Load, failedLoad, ready } from "./load";
import { POLL_MS } from "./use-estate";

/**
 * Who an estate names, and for how much.
 *
 * Deliberately not `useHeirs`: that one waits on the vault's token list so it can say whether each
 * heir has claimed, and resolves an ENS text record per heir. Both are right for a grantor looking
 * at their own estate and wrong for a public list, where a dozen estates would mean a dozen vault
 * reads and every heir's resolver queried to draw a row nobody has expanded yet.
 */
export type RosterHeir = {
  label: string;
  labelhash: bigint;
  address: Address;
  /** `defaultShareOf`, the estate-wide share. Per-token overrides are a grantor-screen concern. */
  shareBps: number;
};

const NO_HASHES: readonly bigint[] = [];

export function useHeirRoster(estateId: bigint): Load<RosterHeir[]> {
  const index = useReadContract({
    ...contracts.heritRegistry,
    functionName: "heirsOf",
    args: [estateId],
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL_MS },
  });
  const hashes = index.data ?? NO_HASHES;
  const some = hashes.length > 0;

  // All three are written once, by `recordHeir`, and never rewritten — so each is read once.
  const labels = useReadContracts({
    allowFailure: false,
    contracts: hashes.map(
      (heirLabelhash) =>
        ({
          ...contracts.heritRegistry,
          functionName: "heirLabelOf",
          args: [estateId, heirLabelhash],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, staleTime: Infinity },
  });
  const addresses = useReadContracts({
    allowFailure: false,
    contracts: hashes.map(
      (heirLabelhash) =>
        ({
          ...contracts.heritRegistry,
          functionName: "heirAddressOf",
          args: [estateId, heirLabelhash],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, staleTime: Infinity },
  });
  const shares = useReadContracts({
    allowFailure: false,
    contracts: hashes.map(
      (heirLabelhash) =>
        ({
          ...contracts.heritRegistry,
          functionName: "defaultShareOf",
          args: [estateId, heirLabelhash],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: some, staleTime: Infinity },
  });

  const failed = failedLoad(index, labels, addresses, shares);
  if (failed) return failed;
  if (index.data === undefined) return LOADING;
  if (!some) return ready([]);

  const labelOf = labels.data;
  const addressOf = addresses.data;
  const shareOf = shares.data;
  if (labelOf === undefined || addressOf === undefined || shareOf === undefined) return LOADING;

  return ready(
    hashes.map((labelhash, i) => ({
      label: labelOf[i],
      labelhash,
      address: addressOf[i],
      shareBps: shareOf[i],
    })),
  );
}
