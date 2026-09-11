"use client";

import { useEffect, useState } from "react";
import { type Address, erc20Abi, isAddressEqual, zeroAddress } from "viem";
import { useReadContracts } from "wagmi";
import { CHAIN_ID, herit, tokens } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { estateIdOf, heirLabelhashOf, isLabel } from "./ids";
import { LOADING, type Load, failedLoad, ready } from "./load";
import { DEPOSIT_ASSETS, type SetupDraft, type SetupLimits, parseDeposit } from "./setup";

/** The setup wizard's chain reads: the registry's bounds, the label, and how far setup has got. */

/** `HeritRegistry`'s timer bounds and heir cap. Constants, so read once. */
export function useSetupLimits(): Load<SetupLimits> {
  const query = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...contracts.heritRegistry, functionName: "MIN_CHECK_IN_INTERVAL", chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "MAX_CHECK_IN_INTERVAL", chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "MIN_GRACE_DURATION", chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "MAX_GRACE_DURATION", chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "MAX_HEIRS", chainId: CHAIN_ID },
    ],
    query: { staleTime: Infinity },
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;

  const [minInterval, maxInterval, minGrace, maxGrace, maxHeirs] = query.data;
  return ready({
    minInterval: Number(minInterval),
    maxInterval: Number(maxInterval),
    minGrace: Number(minGrace),
    maxGrace: Number(maxGrace),
    maxHeirs: Number(maxHeirs),
  });
}

/** `value`, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export type LabelCheck =
  | { kind: "invalid" }
  | { kind: "checking" }
  | { kind: "error"; error: Error; retry: () => void }
  /** Free, and this is where its estate registry will be deployed. */
  | { kind: "available"; registry: Address }
  /** Already opened by the connected wallet: setup resumes rather than starting over. */
  | { kind: "yours" }
  | { kind: "taken" };

/** Whether a label can be opened, checked once typing pauses. */
export function useLabelCheck(label: string, address: Address | undefined): LabelCheck {
  const settled = useDebounced(label, 400);
  const valid = isLabel(settled);
  const estateId = valid ? estateIdOf(settled) : BigInt(0);

  const query = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...contracts.heritRegistry, functionName: "isAvailable", args: [settled], chainId: CHAIN_ID },
      {
        ...contracts.accessControlGate,
        functionName: "predictEstateRegistry",
        args: [estateId],
        chainId: CHAIN_ID,
      },
      {
        ...contracts.accessControlGate,
        functionName: "estatesOfGrantor",
        args: [address ?? zeroAddress],
        chainId: CHAIN_ID,
      },
      { ...contracts.grantorRegistry, functionName: "getOwner", args: [estateId], chainId: CHAIN_ID },
    ],
    query: { enabled: valid },
  });

  if (!isLabel(label)) return { kind: "invalid" };
  if (label !== settled) return { kind: "checking" };
  const failed = failedLoad(query);
  if (failed) return { kind: "error", error: failed.error, retry: failed.retry };
  if (query.data === undefined) return { kind: "checking" };

  const [available, registry, opened, owner] = query.data;
  if (available) return { kind: "available", registry };
  const mine = address !== undefined && isAddressEqual(owner, address) && opened.includes(estateId);
  return mine ? { kind: "yours" } : { kind: "taken" };
}

/**
 * How far setup has got, read entirely from the chain.
 *
 * Nothing here is remembered locally, so a reload mid-setup picks up at the first step the chain
 * has not seen, rather than resending `openEstate` and reverting `EstateAlreadyOpen`.
 */
export type SetupProgress = {
  estateId: bigint;
  /** In `estatesOfGrantor` for this wallet, and registry A still names it. */
  opened: boolean;
  /** Why setup cannot run under this label at all. */
  blocked: string | undefined;
  configured: boolean;
  /** One per drafted heir, in draft order: whether its labelhash is in `heirsOf`. */
  heirsRegistered: boolean[];
  /** Registry A's expiry for the estate name, which every heir subname is capped at. */
  estateExpiry: bigint;
  /** The deposit in base units. Zero for none, undefined when the amount does not parse. */
  depositAmount: bigint | undefined;
  /** The allowance already covers the deposit, or the asset is ETH and needs none. */
  approved: boolean;
  funded: boolean;
  checkedIn: boolean;
};

export function useSetupProgress(
  draft: SetupDraft,
  address: Address | undefined,
): Load<SetupProgress> & { fetching: boolean } {
  const valid = isLabel(draft.label) && address !== undefined;
  const estateId = isLabel(draft.label) ? estateIdOf(draft.label) : BigInt(0);
  const grantor = address ?? zeroAddress;
  const asset = DEPOSIT_ASSETS[draft.deposit.asset];
  const erc20 = draft.deposit.asset !== "eth";

  const core = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...contracts.accessControlGate,
        functionName: "estatesOfGrantor",
        args: [grantor],
        chainId: CHAIN_ID,
      },
      { ...contracts.grantorRegistry, functionName: "getOwner", args: [estateId], chainId: CHAIN_ID },
      { ...contracts.grantorRegistry, functionName: "getExpiry", args: [estateId], chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "isAvailable", args: [draft.label], chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "estateOf", args: [estateId], chainId: CHAIN_ID },
      { ...contracts.heritRegistry, functionName: "heirsOf", args: [estateId], chainId: CHAIN_ID },
      {
        ...contracts.heritVault,
        functionName: "balanceOf",
        args: [estateId, asset.token],
        chainId: CHAIN_ID,
      },
    ],
    query: { enabled: valid },
  });

  const token = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: tokens.mockUsdc, abi: erc20Abi, functionName: "decimals", chainId: CHAIN_ID },
      {
        address: tokens.mockUsdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [grantor, herit.heritVault],
        chainId: CHAIN_ID,
      },
    ],
    query: { enabled: valid && erc20 },
  });

  const fetching = core.isFetching || token.isFetching;

  const failed = failedLoad(core, ...(erc20 ? [token] : []));
  if (failed) return { ...failed, fetching };
  if (!valid || core.data === undefined) return { ...LOADING, fetching };
  if (erc20 && token.data === undefined) return { ...LOADING, fetching };

  const [ids, owner, expiry, available, estate, heirHashes, balance] = core.data;
  const opened = ids.includes(estateId) && isAddressEqual(owner, grantor);
  const blocked =
    opened || available
      ? undefined
      : isAddressEqual(owner, grantor)
        ? "this wallet owns the name, but it was not opened through herit"
        : "someone else already holds this name — go back and pick another label";

  const decimals = erc20 ? (token.data?.[0] ?? 18) : 18;
  const allowance = token.data?.[1] ?? BigInt(0);
  const depositAmount = parseDeposit(draft.deposit.amount, decimals);
  const funded = balance > BigInt(0);

  return {
    ...ready({
      estateId,
      opened,
      blocked,
      configured: opened && estate.checkInInterval > BigInt(0),
      heirsRegistered: draft.heirs.map((heir) => heirHashes.includes(heirLabelhashOf(heir.label))),
      estateExpiry: expiry,
      depositAmount,
      approved: !erc20 || funded || (depositAmount !== undefined && allowance >= depositAmount),
      funded,
      checkedIn: estate.lastCheckIn > BigInt(0),
    }),
    fetching,
  };
}
