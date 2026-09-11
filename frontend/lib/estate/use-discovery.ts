"use client";

import { type Address, isAddressEqual } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { useWallet } from "@/lib/wagmi/use-wallet";
import { LOADING, type Load, failedLoad, ready } from "./load";
import { type Selection, selectEstate, selectHeirSlot } from "./selection";
import type { HeirSlot, OwnedEstate } from "./types";

/**
 * Finding the connected wallet's estates and heir slots, on-chain.
 *
 * Every read pins `chainId` to Sepolia, so a wallet sitting on another network still finds what
 * it holds here. Refusing the wrong network is the write path's job.
 */

/** The wallet, discovery and selection folded into the one value a screen branches on. */
export type Resolved<T> =
  | { kind: "reconnecting" }
  | { kind: "disconnected" }
  | { kind: "loading" }
  | { kind: "error"; error: Error; retry: () => void }
  | Exclude<Selection<T>, { kind: "selected" }>
  | (Extract<Selection<T>, { kind: "selected" }> & { address: Address });

const NO_IDS: readonly bigint[] = [];
const NO_SLOTS: readonly { estateId: bigint; heirLabelhash: bigint }[] = [];

/**
 * Every estate `address` opened and still owns, newest first.
 *
 * `estatesOfGrantor` only records who opened an estate, and the name can be transferred after.
 * An id is kept only while registry A's `getOwner` still names `address`, which also drops an
 * expired name, since `getOwner` reads zero for one.
 *
 * The index only ever appends, and an id cannot be opened twice, so reversing it orders by opening.
 */
export function useMyEstates(address: Address | undefined): Load<OwnedEstate[]> {
  const index = useReadContract({
    ...contracts.accessControlGate,
    functionName: "estatesOfGrantor",
    args: address === undefined ? undefined : [address],
    chainId: CHAIN_ID,
    query: { enabled: address !== undefined },
  });
  const ids = index.data ?? NO_IDS;

  // Both depend only on the ids, so they run side by side rather than one after the other.
  const owners = useReadContracts({
    allowFailure: false,
    contracts: ids.map(
      (estateId) =>
        ({
          ...contracts.grantorRegistry,
          functionName: "getOwner",
          args: [estateId],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: ids.length > 0 },
  });
  const labels = useEstateLabels(ids);

  const failed = failedLoad(index, owners, labels);
  if (failed) return failed;
  if (address === undefined || index.data === undefined) return LOADING;
  if (ids.length === 0) return ready([]);

  const ownerOf = owners.data;
  const labelOf = labels.data;
  if (ownerOf === undefined || labelOf === undefined) return LOADING;

  const grantor = address;
  const entries = ids.flatMap((estateId, i) => {
    const owner = ownerOf[i];
    const label = labelOf[i];
    return owner !== undefined && isAddressEqual(owner, grantor) && label ? [{ estateId, label }] : [];
  });
  return ready(entries.reverse());
}

/**
 * Every heir slot naming `address`, with both labels read back.
 *
 * Unlike the grantor index this one needs no confirming: an heir's address is fixed when it is
 * recorded, and nothing in `HeritRegistry` reassigns it.
 */
export function useMyHeirSlots(address: Address | undefined): Load<HeirSlot[]> {
  const index = useReadContract({
    ...contracts.heritRegistry,
    functionName: "heirSlotsOf",
    args: address === undefined ? undefined : [address],
    chainId: CHAIN_ID,
    query: { enabled: address !== undefined },
  });
  const slots = index.data ?? NO_SLOTS;

  const heirLabels = useReadContracts({
    allowFailure: false,
    contracts: slots.map(
      (slot) =>
        ({
          ...contracts.heritRegistry,
          functionName: "heirLabelOf",
          args: [slot.estateId, slot.heirLabelhash],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: slots.length > 0 },
  });
  const estateLabels = useEstateLabels(slots.map((slot) => slot.estateId));

  const failed = failedLoad(index, heirLabels, estateLabels);
  if (failed) return failed;
  if (index.data === undefined) return LOADING;
  if (slots.length === 0) return ready([]);

  const heirLabelOf = heirLabels.data;
  const estateLabelOf = estateLabels.data;
  if (heirLabelOf === undefined || estateLabelOf === undefined) return LOADING;

  const entries = slots.flatMap((slot, i) => {
    const heirLabel = heirLabelOf[i];
    const estateLabel = estateLabelOf[i];
    return heirLabel && estateLabel
      ? [{ estateId: slot.estateId, heirLabelhash: slot.heirLabelhash, heirLabel, estateLabel }]
      : [];
  });
  return ready(entries);
}

/** The estate a grantor screen shows: `?estate=<label>` when given, otherwise the latest opened. */
export function useSelectedEstate(label: string | undefined): Resolved<OwnedEstate> {
  const wallet = useWallet();
  const discovery = useMyEstates(wallet.address);
  return resolve(wallet, discovery, (entries) => selectEstate(entries, label));
}

/** The slot the claim screen shows: `?estate=&heir=` when given, otherwise the first found. */
export function useSelectedHeirSlot(params: { estate?: string; heir?: string }): Resolved<HeirSlot> {
  const wallet = useWallet();
  const discovery = useMyHeirSlots(wallet.address);
  return resolve(wallet, discovery, (entries) => selectHeirSlot(entries, params));
}

function resolve<T>(
  wallet: { address: Address | undefined; isConnected: boolean; isReconnecting: boolean },
  discovery: Load<T[]>,
  select: (entries: T[]) => Selection<T>,
): Resolved<T> {
  if (wallet.isReconnecting) return { kind: "reconnecting" };
  if (!wallet.isConnected || wallet.address === undefined) return { kind: "disconnected" };
  if (discovery.status === "loading") return { kind: "loading" };
  if (discovery.status === "error") {
    return { kind: "error", error: discovery.error, retry: discovery.retry };
  }

  const selection = select(discovery.data);
  return selection.kind === "selected" ? { ...selection, address: wallet.address } : selection;
}

/** `LabelStore.getLabel` per estate id, the only way back from an id to its name. */
function useEstateLabels(estateIds: readonly bigint[]) {
  return useReadContracts({
    allowFailure: false,
    contracts: estateIds.map(
      (estateId) =>
        ({
          ...contracts.labelStore,
          functionName: "getLabel",
          args: [estateId],
          chainId: CHAIN_ID,
        }) as const,
    ),
    query: { enabled: estateIds.length > 0 },
  });
}
