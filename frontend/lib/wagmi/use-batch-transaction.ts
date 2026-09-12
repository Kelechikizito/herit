"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import { simulateCalls } from "viem/actions";
import { type Config, useConfig } from "wagmi";
import { getCapabilities, getPublicClient, sendCalls, waitForCallsStatus } from "wagmi/actions";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import type { ContractCall } from "@/lib/contracts/call";
import { describeError, hasErrorNamed } from "@/lib/contracts/errors";
import { type CallPhase, type TxPhase, executeCall, refreshAfterConfirm } from "./use-transaction";
import { useWallet } from "./use-wallet";

/**
 * Several writes behind one click.
 *
 * `atomic` — a wallet that supports EIP-5792 atomic batches (an EIP-7702 account such as MetaMask's,
 * or a smart wallet) takes every call in one prompt, and they land in one transaction or not at all.
 * Each call still executes with the user's own address as `msg.sender`, which is what every
 * `onlyGrantorOf` check and `LivenessAttestor`'s `subject == msg.sender` compare against. A
 * Multicall contract would fail all of them.
 *
 * `sequential` — every other wallet gets one prompt per call, each waiting for the last receipt.
 * Deliberately not viem's `experimental_fallback`, which fires all of them without waiting: the
 * wallet would estimate `configure` against a chain where `openEstate` has not landed, and refuse it.
 */

export type BatchMode = "atomic" | "sequential";

export type BatchState = {
  phase: TxPhase;
  /** The mode actually used, which is not always the one asked for — see `NO_BATCHING`. */
  mode: BatchMode | undefined;
  /** The call in flight, counted from zero. Only moves in `sequential`; `atomic` sends them as one. */
  current: number;
  /** The last phase that was actually running, kept through an error so a progress view can mark where it stopped. */
  reached: CallPhase | undefined;
  error: string | undefined;
  hash: Hash | undefined;
};

const IDLE: BatchState = {
  phase: "idle",
  mode: undefined,
  current: 0,
  reached: undefined,
  error: undefined,
  hash: undefined,
};

/**
 * What a wallet says when it cannot batch after all — its capabilities claimed otherwise, or the
 * user's account was never upgraded. Worth falling back for rather than failing in front of them.
 */
const NO_BATCHING = new Set([
  "AtomicityNotSupportedError",
  "MethodNotFoundRpcError",
  "MethodNotSupportedRpcError",
  "UnsupportedNonOptionalCapabilityError",
]);

/** How long a batch may take to confirm. A ten-heir setup is one heavy transaction. */
const BATCH_TIMEOUT_MS = 5 * 60 * 1000;

export function useBatchTransaction() {
  const wagmiConfig = useConfig();
  const queryClient = useQueryClient();
  const { address, isConnected, isWrongNetwork } = useWallet();

  const [state, setState] = useState<BatchState>(IDLE);
  // A second click while the first prompt is open would stack two wallet prompts.
  const inFlight = useRef(false);

  /** Why nothing can be sent right now, for a disabled button to say. */
  const blocked = !isConnected
    ? "connect a wallet first"
    : isWrongNetwork
      ? "switch your wallet to sepolia"
      : undefined;

  /**
   * Whether this wallet can take the calls as one atomic batch. Asked per run rather than cached:
   * the user can switch wallets, or upgrade one, between two clicks.
   */
  const detectMode = useCallback(async (): Promise<BatchMode> => {
    try {
      const capabilities = await getCapabilities(wagmiConfig, { chainId: CHAIN_ID });
      const atomic = capabilities.atomic?.status;
      // `ready` means the wallet will upgrade the account as part of the same prompt.
      return atomic === "supported" || atomic === "ready" ? "atomic" : "sequential";
    } catch {
      // A wallet without EIP-5792 rejects `wallet_getCapabilities` outright.
      return "sequential";
    }
  }, [wagmiConfig]);

  const send = useCallback(
    async (calls: readonly ContractCall[], mode: BatchMode): Promise<boolean> => {
      if (inFlight.current || calls.length === 0) return false;
      if (blocked !== undefined || address === undefined) {
        setState({ ...IDLE, phase: "error", error: blocked ?? "connect a wallet first" });
        return false;
      }

      inFlight.current = true;
      try {
        if (mode === "atomic") {
          const result = await runAtomic(wagmiConfig, queryClient, calls, address, setState);
          if (result !== "cannot-batch") return result;
          // The wallet said it could batch and then would not. One prompt per call still works.
        }
        return await runSequential(wagmiConfig, queryClient, calls, setState);
      } finally {
        inFlight.current = false;
      }
    },
    [address, blocked, queryClient, wagmiConfig],
  );

  const reset = useCallback(() => setState(IDLE), []);

  return {
    ...state,
    /** Between the click and the last receipt. */
    busy: state.phase === "simulating" || state.phase === "awaiting-signature" || state.phase === "confirming",
    blocked,
    detectMode,
    send,
    reset,
  };
}

type SetBatchState = (state: BatchState) => void;

/** Every call in one signature, landing in one transaction or not at all. */
async function runAtomic(
  config: Config,
  queryClient: ReturnType<typeof useQueryClient>,
  calls: readonly ContractCall[],
  account: Address,
  setState: SetBatchState,
): Promise<boolean | "cannot-batch"> {
  const base = { mode: "atomic", current: 0, error: undefined, hash: undefined } as const;
  const sent: { hash: Hash | undefined } = { hash: undefined };
  try {
    setState({ ...base, phase: "simulating", reached: "simulating" });
    await simulateTogether(config, calls, account);

    setState({ ...base, phase: "awaiting-signature", reached: "awaiting-signature" });
    const { id } = await sendCalls(config, {
      chainId: CHAIN_ID,
      // The wallet must refuse rather than split them up: a half-applied setup is worse than none.
      forceAtomic: true,
      calls: calls.map(toWalletCall) as never,
    });

    setState({ ...base, phase: "confirming", reached: "confirming" });
    const result = await waitForCallsStatus(config, { id, timeout: BATCH_TIMEOUT_MS });
    // ES2017: no `Array.prototype.at`.
    const receipt = result.receipts?.[(result.receipts?.length ?? 0) - 1];
    sent.hash = receipt?.transactionHash;

    const reverted = (result.receipts ?? []).some((entry) => entry.status !== "success");
    if (result.status !== "success" || receipt === undefined || reverted) {
      setState({
        ...base,
        phase: "error",
        reached: "confirming",
        hash: sent.hash,
        error: "the batch reverted on-chain, so none of it landed",
      });
      return false;
    }

    await refreshAfterConfirm(queryClient, receipt.blockNumber);
    setState({ ...base, phase: "success", reached: undefined, current: calls.length, hash: sent.hash });
    return true;
  } catch (error) {
    if (hasErrorNamed(error, NO_BATCHING)) return "cannot-batch";
    setState({
      ...base,
      phase: "error",
      reached: "awaiting-signature",
      hash: sent.hash,
      error: describeError(error),
    });
    return false;
  }
}

/** The part of a simulated call this reads back: whether it would revert, and with what. */
type SimulatedCall = { status: "success" | "failure"; error?: Error };

/**
 * Every call run in order against one simulated block, so `configure` sees the estate `openEstate`
 * opened a call earlier.
 *
 * Needs `eth_simulateV1`. An RPC without it skips the check rather than blocking the user — the
 * wallet estimates the batch before it prompts anyway, and the contracts refuse a bad call whether
 * or not this runs.
 */
async function simulateTogether(config: Config, calls: readonly ContractCall[], account: Address) {
  const client = getPublicClient(config, { chainId: CHAIN_ID });
  if (!client) return;

  let results: readonly SimulatedCall[];
  try {
    // The calls were type-checked where they were built; the widened list only passes through here,
    // which costs viem's own inference — hence the shape this reads back.
    const simulation = (await simulateCalls(client, {
      account,
      calls: calls.map(toWalletCall),
    } as never)) as { results: readonly SimulatedCall[] };
    results = simulation.results;
  } catch (error) {
    // Name only: viem's messages quote the RPC URL, which carries the provider key.
    console.warn(
      `[batch] simulation unavailable, sending unchecked: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return;
  }

  // The first call that would revert, reported the way a single simulation would report it.
  const failed = results.find((result) => result.status === "failure");
  if (failed?.error) throw failed.error;
}

/** One prompt per call, each waiting for the last receipt, for a wallet that cannot batch. */
async function runSequential(
  config: Config,
  queryClient: ReturnType<typeof useQueryClient>,
  calls: readonly ContractCall[],
  setState: SetBatchState,
): Promise<boolean> {
  const sent: { hash: Hash | undefined } = { hash: undefined };
  let current = 0;
  try {
    for (const [index, call] of calls.entries()) {
      current = index;
      const receipt = await executeCall(config, call, (phase, hash) => {
        sent.hash = hash;
        setState({
          phase,
          mode: "sequential",
          current: index,
          reached: phase,
          error: undefined,
          hash,
        });
      });
      // Per receipt rather than once at the end, so each step's tick appears as it lands.
      await refreshAfterConfirm(queryClient, receipt.blockNumber);
    }
    setState({
      phase: "success",
      mode: "sequential",
      current: calls.length,
      reached: undefined,
      error: undefined,
      hash: sent.hash,
    });
    return true;
  } catch (error) {
    setState({
      phase: "error",
      mode: "sequential",
      current,
      reached: "awaiting-signature",
      error: describeError(error),
      hash: sent.hash,
    });
    return false;
  }
}

/** EIP-5792 addresses a call with `to`, where a contract read or write uses `address`. */
function toWalletCall({ address, ...call }: ContractCall) {
  return { to: address, ...call };
}
