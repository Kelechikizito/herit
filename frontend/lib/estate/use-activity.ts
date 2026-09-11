"use client";

import { useQuery } from "@tanstack/react-query";
import { type EstateActivity, fetchEstateActivity } from "@/lib/subgraph/activity";
import { SUBGRAPH_URL } from "@/lib/subgraph/client";
import { type ConfirmedBlock, useConfirmedBlock } from "@/lib/subgraph/confirmed-block";
import { LOADING, type Load, failedLoad, ready } from "./load";

/** How many events the feed shows. */
const FEED_LENGTH = 50;

/**
 * Studio's development endpoint allows 3,000 queries a day. Every 30 s stays under that for one tab
 * left open around the clock, and a hidden tab does not poll at all.
 */
const ACTIVITY_POLL_MS = 30_000;

/** While the indexer trails a transaction this tab just confirmed. Indexing lag is a block or so. */
const CATCH_UP_POLL_MS = 4_000;

/** Stop catching up after this long, so a stalled indexer is not polled fast forever. */
const CATCH_UP_WINDOW_MS = 120_000;

/**
 * One estate's event history, from the herit subgraph. Never resolves while `SUBGRAPH_URL` is
 * unset: the activity card checks that first and says so.
 */
export function useEstateActivity(estateId: bigint): Load<EstateActivity> {
  const confirmed = useConfirmedBlock();

  const query = useQuery({
    // Keyed on the URL too, so pointing at a redeployed subgraph never shows the old one's cache.
    queryKey: ["subgraph", SUBGRAPH_URL, "estateActivity", estateId.toString()],
    queryFn: ({ signal }) => fetchEstateActivity(estateId, FEED_LENGTH, signal),
    enabled: SUBGRAPH_URL !== undefined,
    refetchInterval: (current) =>
      isBehind(current.state.data, confirmed) ? CATCH_UP_POLL_MS : ACTIVITY_POLL_MS,
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;
  return ready(query.data);
}

function isBehind(activity: EstateActivity | undefined, confirmed: ConfirmedBlock | undefined): boolean {
  if (activity === undefined || confirmed === undefined) return false;
  return (
    BigInt(activity.indexedBlock) < confirmed.block && Date.now() - confirmed.at < CATCH_UP_WINDOW_MS
  );
}
