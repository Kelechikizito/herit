"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hash } from "viem";
import { type Config, useConfig } from "wagmi";
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import type { ContractCall, Mutability, TxRequest } from "@/lib/contracts/call";
import { describeError } from "@/lib/contracts/errors";
import { noteConfirmedBlock } from "@/lib/subgraph/confirmed-block";
import { useWallet } from "./use-wallet";

/**
 * Every write the app sends goes through here: simulate, then the wallet prompt, then the receipt.
 *
 * Imperative rather than three bound hooks, because the arguments often only exist at the moment
 * of sending — an attestation arrives in a callback and expires minutes later, and setup runs
 * one step after another. The simulation still runs before every prompt, which is what turns most
 * reverts into a sentence before the user is asked to sign anything.
 */

export type { TxRequest } from "@/lib/contracts/call";

/** Where a single call has got to, between the click and the receipt. */
export type CallPhase = "simulating" | "awaiting-signature" | "confirming";

export type TxPhase = "idle" | CallPhase | "success" | "error";

export type TxState = {
  phase: TxPhase;
  /** A sentence from `describeError`, set only in the error phase. */
  error: string | undefined;
  /** Set once the wallet has broadcast, so a pending or failed transaction can be looked up. */
  hash: Hash | undefined;
};

const IDLE: TxState = { phase: "idle", error: undefined, hash: undefined };

/** The query families a write can change: contract reads, balances, and the heirs' text records. */
const CHAIN_READS = new Set(["readContract", "readContracts", "balance", "ensText"]);

/**
 * One call, from the simulation to the receipt, reporting each phase as it starts and throwing at
 * the first thing that stops it.
 *
 * Shared by `useTransaction` and the one-at-a-time path of `useBatchTransaction`, so both check
 * before prompting and both wait for the same receipt.
 */
export async function executeCall(
  config: Config,
  call: ContractCall,
  onPhase: (phase: CallPhase, hash: Hash | undefined) => void,
) {
  onPhase("simulating", undefined);
  // The request was type-checked where it was built; here it only passes through.
  const simulation = await simulateContract(config, { ...call, chainId: CHAIN_ID } as never);

  onPhase("awaiting-signature", undefined);
  // The simulated request, so the wallet signs exactly what was just checked.
  const hash = await writeContract(config, simulation.request as never);

  onPhase("confirming", hash);
  const receipt = await waitForTransactionReceipt(config, { hash, chainId: CHAIN_ID });
  if (receipt.status !== "success") {
    // `describeError` passes a plain message through, and the caller still holds the hash.
    throw new Error("the transaction reverted on-chain");
  }
  return receipt;
}

/**
 * What follows a receipt: point the activity feed at the block, then re-read the chain. Awaited, so
 * a caller that moves on afterwards sees the chain as it now is.
 */
export async function refreshAfterConfirm(queryClient: QueryClient, blockNumber: bigint) {
  // The activity feed reads an indexer, which trails the receipt: tell it which block to wait for.
  noteConfirmedBlock(blockNumber);
  await queryClient.invalidateQueries({
    predicate: (query) => CHAIN_READS.has(String(query.queryKey[0])),
  });
}

export function useTransaction() {
  const wagmiConfig = useConfig();
  const queryClient = useQueryClient();
  const { isConnected, isWrongNetwork } = useWallet();

  const [state, setState] = useState<TxState>(IDLE);
  // A second click while the first prompt is open would stack two wallet prompts.
  const inFlight = useRef(false);

  /** Why nothing can be sent right now, for a disabled button to say. */
  const blocked = !isConnected
    ? "connect a wallet first"
    : isWrongNetwork
      ? "switch your wallet to sepolia"
      : undefined;

  const send = useCallback(
    async <
      const abi extends Abi,
      functionName extends ContractFunctionName<abi, Mutability>,
      const args extends ContractFunctionArgs<abi, Mutability, functionName>,
    >(
      request: TxRequest<abi, functionName, args>,
    ): Promise<boolean> => {
      if (inFlight.current) return false;
      if (blocked) {
        setState({ phase: "error", error: blocked, hash: undefined });
        return false;
      }

      inFlight.current = true;
      // Held in an object because it is written from the phase callback below, and read again in
      // the catch: a failed transaction still has a hash worth linking to.
      const sent: { hash: Hash | undefined } = { hash: undefined };
      try {
        const receipt = await executeCall(
          wagmiConfig,
          request as unknown as ContractCall,
          (phase, hash) => {
            sent.hash = hash;
            setState({ phase, error: undefined, hash });
          },
        );
        await refreshAfterConfirm(queryClient, receipt.blockNumber);
        setState({ phase: "success", error: undefined, hash: sent.hash });
        return true;
      } catch (error) {
        setState({ phase: "error", error: describeError(error), hash: sent.hash });
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [blocked, queryClient, wagmiConfig],
  );

  const reset = useCallback(() => setState(IDLE), []);

  return {
    ...state,
    /** Between the click and the receipt. */
    busy: state.phase === "simulating" || state.phase === "awaiting-signature" || state.phase === "confirming",
    blocked,
    send,
    reset,
  };
}

/** What a button says while its transaction is under way. */
export function pendingLabel(phase: TxPhase | undefined): string | undefined {
  switch (phase) {
    case "simulating":
      return "checking…";
    case "awaiting-signature":
      return "confirm in your wallet…";
    case "confirming":
      return "confirming on sepolia…";
    default:
      return undefined;
  }
}

export function explorerTxUrl(hash: Hash): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}
