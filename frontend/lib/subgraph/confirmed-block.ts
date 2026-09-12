import { useSyncExternalStore } from "react";

/**
 * The block of the last transaction this tab saw confirmed, so the activity feed can tell that the
 * indexer is behind a write the user just made and read again sooner.
 *
 * Outside TanStack Query on purpose: invalidating the feed on the receipt would re-read it before
 * the indexer has the block, and show nothing new until the next slow poll.
 */
export type ConfirmedBlock = {
  block: bigint;
  /** `Date.now()` when noted, so a stalled indexer is not polled fast forever. */
  at: number;
};

let latest: ConfirmedBlock | undefined;
const listeners = new Set<() => void>();

export function noteConfirmedBlock(block: bigint): void {
  if (latest !== undefined && block <= latest.block) return;
  latest = { block, at: Date.now() };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConfirmedBlock(): ConfirmedBlock | undefined {
  return useSyncExternalStore(
    subscribe,
    () => latest,
    () => undefined,
  );
}
