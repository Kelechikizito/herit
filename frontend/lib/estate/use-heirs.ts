"use client";

import { useQueries } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { fullName } from "./format";
import { LOADING, type Load, failedLoad, ready } from "./load";
import type { Heir, Vault } from "./types";
import { POLL_MS } from "./use-estate";

const NO_HASHES: readonly bigint[] = [];
const NO_LABELS: readonly string[] = [];
const NO_SHARES: readonly bigint[] = [];
const NO_FLAGS: readonly boolean[] = [];

const RELATIONSHIP_KEY = "herit.relationship";

/**
 * Every heir recorded against an estate, with their claim role and their position in each vault
 * token.
 *
 * Takes the vault's load from `useVault` for its token list. Until that arrives the heirs stay
 * loading, because a row without its holdings cannot say whether that heir has claimed — and if
 * the vault read fails, the heirs report that failure rather than wait on it forever.
 */
export function useHeirs(estateId: bigint, estateLabel: string, vault: Load<Vault>): Load<Heir[]> {
  const tokens = vault.status === "ready" ? vault.data.tokens.map((token) => token.token) : undefined;

  const index = useReadContract({
    ...contracts.heritRegistry,
    functionName: "heirsOf",
    args: [estateId],
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL_MS },
  });
  const hashes = index.data ?? NO_HASHES;
  const some = hashes.length > 0;

  // Written once by `recordHeir` and never rewritten, so each is read once.
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
  const defaultShares = useReadContracts({
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

  // `canClaim` asks by label and address, so it waits on both. Polled: it flips on unlock.
  const labelOf = labels.data;
  const addressOf = addresses.data;
  const roles = useReadContracts({
    allowFailure: false,
    contracts:
      labelOf === undefined || addressOf === undefined
        ? []
        : hashes.map(
            (_, i) =>
              ({
                ...contracts.accessControlGate,
                functionName: "canClaim",
                args: [estateId, labelOf[i], addressOf[i]],
                chainId: CHAIN_ID,
              }) as const,
          ),
    query: {
      enabled: some && labelOf !== undefined && addressOf !== undefined,
      refetchInterval: POLL_MS,
    },
  });

  // One entry per heir × token, heir-major, so heir i's token j sits at i × tokens + j.
  const pairs =
    tokens === undefined
      ? []
      : hashes.flatMap((heirLabelhash) => tokens.map((token) => ({ heirLabelhash, token })));
  const shares = useReadContracts({
    allowFailure: false,
    contracts: pairs.map(
      ({ heirLabelhash, token }) =>
        ({
          ...contracts.heritRegistry,
          functionName: "shareOf",
          args: [estateId, heirLabelhash, token],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: pairs.length > 0 },
  });
  const claimed = useReadContracts({
    allowFailure: false,
    contracts: pairs.map(
      ({ heirLabelhash, token }) =>
        ({
          ...contracts.claimManager,
          functionName: "hasClaimed",
          args: [estateId, heirLabelhash, token],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: pairs.length > 0, refetchInterval: POLL_MS },
  });

  const relationships = useRelationships(estateLabel, labelOf ?? NO_LABELS);

  const failed = failedLoad(index, labels, addresses, defaultShares, roles, shares, claimed);
  if (failed) return failed;
  if (vault.status === "error") return vault;
  if (index.data === undefined || tokens === undefined) return LOADING;
  if (!some) return ready([]);

  const shareOf = defaultShares.data;
  const roleOf = roles.data;
  if (labelOf === undefined || addressOf === undefined || shareOf === undefined || roleOf === undefined) {
    return LOADING;
  }
  if (pairs.length > 0 && (shares.data === undefined || claimed.data === undefined)) return LOADING;
  const tokenShareOf = shares.data ?? NO_SHARES;
  const claimedOf = claimed.data ?? NO_FLAGS;

  return ready(
    hashes.map((labelhash, i) => ({
      label: labelOf[i],
      labelhash,
      address: addressOf[i],
      relationship: relationships[i],
      shareBps: shareOf[i],
      canClaim: roleOf[i],
      holdings: tokens.map((token, j) => {
        const k = i * tokens.length + j;
        return { token, shareBps: Number(tokenShareOf[k]), claimed: claimedOf[k] };
      }),
    })),
  );
}

/**
 * Each heir's `herit.relationship` text record, resolved through the hackathon Universal Resolver
 * that `lib/wagmi/chains.ts` sets on the chain.
 *
 * Never holds up the heir list: a record still resolving, or one that cannot be read, comes back
 * undefined and the row shows a dash.
 */
function useRelationships(estateLabel: string, heirLabels: readonly string[]): (string | undefined)[] {
  const client = usePublicClient({ chainId: CHAIN_ID });

  const results = useQueries({
    queries: heirLabels.map((heirLabel) => {
      const name = fullName({ label: estateLabel }, heirLabel);
      return {
        queryKey: ["ensText", CHAIN_ID, name, RELATIONSHIP_KEY],
        queryFn: async () => {
          if (client === undefined) throw new Error("no Sepolia client configured");
          return (await client.getEnsText({ name, key: RELATIONSHIP_KEY })) ?? "";
        },
        enabled: client !== undefined,
        // Written once, when the heir is registered.
        staleTime: Infinity,
        retry: 1,
      };
    }),
  });

  return results.map((result) => (result.data ? result.data : undefined));
}
