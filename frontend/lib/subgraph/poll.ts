import type { ConfirmedBlock } from "./confirmed-block";

/**
 * How often the app asks the indexer, shared by every subgraph-backed read.
 *
 * Studio's development endpoint allows 3,000 queries a day. Every 30 s stays under that for one
 * tab left open around the clock, and a hidden tab does not poll at all.
 */
export const SUBGRAPH_POLL_MS = 30_000;

/** While the indexer trails a transaction this tab just confirmed. Indexing lag is a block or so. */
const CATCH_UP_POLL_MS = 4_000;

/** Stop catching up after this long, so a stalled indexer is not polled fast forever. */
const CATCH_UP_WINDOW_MS = 120_000;

/**
 * When to ask again, given how far the indexer has got and the last block this tab saw confirmed.
 *
 * A write the user just made is the one moment the feed is knowably stale, so that is the only
 * moment worth spending queries on.
 */
export function subgraphPollMs(
  indexedBlock: number | undefined,
  confirmed: ConfirmedBlock | undefined,
): number {
  if (indexedBlock === undefined || confirmed === undefined) return SUBGRAPH_POLL_MS;

  const behind =
    BigInt(indexedBlock) < confirmed.block && Date.now() - confirmed.at < CATCH_UP_WINDOW_MS;
  return behind ? CATCH_UP_POLL_MS : SUBGRAPH_POLL_MS;
}
