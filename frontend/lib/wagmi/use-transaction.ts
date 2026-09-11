"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type {
  Abi,
  ContractFunctionArgs,
  ContractFunctionName,
  ContractFunctionParameters,
  Hash,
} from "viem";
import { useConfig } from "wagmi";
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { describeError } from "@/lib/contracts/errors";
import { useWallet } from "./use-wallet";

/**
 * Every write the app sends goes through here: simulate, then the wallet prompt, then the receipt.
 *
 * Imperative rather than three bound hooks, because the arguments often only exist at the moment
 * of sending — an attestation arrives in a callback and expires in five minutes, and setup runs
 * one step after another. The simulation still runs before every prompt, which is what turns most
 * reverts into a sentence before the user is asked to sign anything.
 */

export type TxPhase =
  | "idle"
  | "simulating"
  | "awaiting-signature"
  | "confirming"
  | "success"
  | "error";

export type TxState = {
  phase: TxPhase;
  /** A sentence from `describeError`, set only in the error phase. */
  error: string | undefined;
  /** Set once the wallet has broadcast, so a pending or failed transaction can be looked up. */
  hash: Hash | undefined;
};

type Mutability = "nonpayable" | "payable";

/**
 * Address, ABI, function and arguments, checked against each other at the call site. viem's shape
 * rather than wagmi's: wagmi's per-chain parameter union is too large for TypeScript to carry
 * through a generic callback.
 */
export type TxRequest<
  abi extends Abi,
  functionName extends ContractFunctionName<abi, Mutability>,
  args extends ContractFunctionArgs<abi, Mutability, functionName>,
> = ContractFunctionParameters<abi, Mutability, functionName, args> & { value?: bigint };

const IDLE: TxState = { phase: "idle", error: undefined, hash: undefined };

/** The query families a write can change: contract reads, balances, and the heirs' text records. */
const CHAIN_READS = new Set(["readContract", "readContracts", "balance", "ensText"]);

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
      let hash: Hash | undefined;
      try {
        setState({ phase: "simulating", error: undefined, hash: undefined });
        // The request was type-checked where it was built; here it only passes through.
        const simulation = await simulateContract(wagmiConfig, {
          ...request,
          chainId: CHAIN_ID,
        } as never);

        setState({ phase: "awaiting-signature", error: undefined, hash: undefined });
        // The simulated request, so the wallet signs exactly what was just checked.
        hash = await writeContract(wagmiConfig, simulation.request as never);

        setState({ phase: "confirming", error: undefined, hash });
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN_ID });
        if (receipt.status !== "success") {
          setState({ phase: "error", error: "the transaction reverted on-chain", hash });
          return false;
        }

        // Awaited, so a caller that moves on after `send` resolves sees the chain as it now is.
        await queryClient.invalidateQueries({
          predicate: (query) => CHAIN_READS.has(String(query.queryKey[0])),
        });
        setState({ phase: "success", error: undefined, hash });
        return true;
      } catch (error) {
        setState({ phase: "error", error: describeError(error), hash });
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
export function pendingLabel(phase: TxPhase): string | undefined {
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
