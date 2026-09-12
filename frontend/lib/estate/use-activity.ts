"use client";

import { useQuery } from "@tanstack/react-query";
import { type EstateActivity, fetchEstateActivity } from "@/lib/subgraph/activity";
import { SUBGRAPH_URL } from "@/lib/subgraph/client";
import { useConfirmedBlock } from "@/lib/subgraph/confirmed-block";
import { subgraphPollMs } from "@/lib/subgraph/poll";
import { LOADING, type Load, failedLoad, ready } from "./load";

/** How many events the feed shows. */
const FEED_LENGTH = 50;

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
    refetchInterval: (current) => subgraphPollMs(current.state.data?.indexedBlock, confirmed),
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;
  return ready(query.data);
}
