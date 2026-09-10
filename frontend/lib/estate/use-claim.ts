"use client";

import { useReadContract } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { Claimable } from "./types";
import { POLL_MS } from "./use-estate";

/**
 * What one heir can take of each vault token, as `ClaimManager.claimableAll` computes it.
 *
 * Measured off the vault snapshot, so every amount reads zero until the unlock transition runs.
 * Before then the claim card estimates from the live balance and the heir's `shareOf` instead,
 * both of which it already has from `useVault` and `useHeirs` — as it does for `hasClaimed`.
 */
export function useClaim(estateId: bigint, heirLabelhash: bigint): Load<Claimable[]> {
  const query = useReadContract({
    ...contracts.claimManager,
    functionName: "claimableAll",
    args: [estateId, heirLabelhash],
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL_MS },
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;

  const [tokens, amounts] = query.data;
  return ready(tokens.map((token, i) => ({ token, amount: amounts[i] })));
}
