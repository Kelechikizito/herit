"use client";

import { type Address, erc20Abi, isAddressEqual } from "viem";
import { useReadContracts } from "wagmi";
import { CHAIN_ID, NATIVE_TOKEN } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { shortAddress } from "./format";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { Vault } from "./types";
import { POLL_MS } from "./use-estate";

const NO_TOKENS: readonly Address[] = [];

/**
 * What `HeritVault` holds for one estate: every listed token with its balance and snapshot, and
 * whether the snapshot has been taken.
 */
export function useVault(estateId: bigint): Load<Vault> {
  const index = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...contracts.heritVault, functionName: "tokensOf", args: [estateId], chainId: CHAIN_ID },
      { ...contracts.heritVault, functionName: "snapshotTaken", args: [estateId], chainId: CHAIN_ID },
    ],
    query: { refetchInterval: POLL_MS },
  });
  const tokens = index.data?.[0] ?? NO_TOKENS;
  const erc20s = tokens.filter((token) => !isAddressEqual(token, NATIVE_TOKEN));

  const balances = useReadContracts({
    allowFailure: false,
    contracts: tokens.map(
      (token) =>
        ({
          ...contracts.heritVault,
          functionName: "balanceOf",
          args: [estateId, token],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: tokens.length > 0, refetchInterval: POLL_MS },
  });
  const snapshots = useReadContracts({
    allowFailure: false,
    contracts: tokens.map(
      (token) =>
        ({
          ...contracts.heritVault,
          functionName: "snapshotOf",
          args: [estateId, token],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: tokens.length > 0, refetchInterval: POLL_MS },
  });

  const metadata = useTokenMetadata(erc20s);

  const failed = failedLoad(index, balances, snapshots, metadata.symbols, metadata.decimals);
  if (failed) return failed;
  if (index.data === undefined) return LOADING;

  const snapshotTaken = index.data[1];
  if (tokens.length === 0) return ready({ tokens: [], snapshotTaken });

  const balanceOf = balances.data;
  const snapshotOf = snapshots.data;
  const symbolOf = metadata.symbols.data;
  const decimalsOf = metadata.decimals.data;
  if (balanceOf === undefined || snapshotOf === undefined) return LOADING;
  if (erc20s.length > 0 && (symbolOf === undefined || decimalsOf === undefined)) return LOADING;

  return ready({
    snapshotTaken,
    tokens: tokens.map((token, i) => {
      const balance = balanceOf[i];
      const snapshot = snapshotOf[i];
      if (isAddressEqual(token, NATIVE_TOKEN)) {
        return { token, symbol: "ETH", decimals: 18, balance, snapshot };
      }

      // A token that does not answer is shown by address and in raw units, rather than guessed at.
      const j = erc20s.indexOf(token);
      const symbol = symbolOf?.[j];
      const decimals = decimalsOf?.[j];
      return {
        token,
        symbol: symbol?.status === "success" ? symbol.result : shortAddress(token),
        decimals: symbol?.status === "success" && decimals?.status === "success" ? decimals.result : 0,
        balance,
        snapshot,
      };
    }),
  });
}

/**
 * `symbol` and `decimals` for each ERC20. Read once: they belong to the token, not the estate.
 * Failures are allowed per call, since a grantor can deposit any contract that pulls.
 */
function useTokenMetadata(tokens: readonly Address[]) {
  const symbols = useReadContracts({
    contracts: tokens.map(
      (token) => ({ address: token, abi: erc20Abi, functionName: "symbol", chainId: CHAIN_ID }) as const,
    ),
    query: { enabled: tokens.length > 0, staleTime: Infinity },
  });
  const decimals = useReadContracts({
    contracts: tokens.map(
      (token) => ({ address: token, abi: erc20Abi, functionName: "decimals", chainId: CHAIN_ID }) as const,
    ),
    query: { enabled: tokens.length > 0, staleTime: Infinity },
  });
  return { symbols, decimals };
}
