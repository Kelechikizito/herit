"use client";

import { useQuery } from "@tanstack/react-query";
import { SUBGRAPH_URL } from "@/lib/subgraph/client";
import { useConfirmedBlock } from "@/lib/subgraph/confirmed-block";
import { type AllEstates, fetchAllEstates } from "@/lib/subgraph/estates";
import { subgraphPollMs } from "@/lib/subgraph/poll";
import { LOADING, type Load, failedLoad, ready } from "./load";

/** How many estates the explorer lists. A hackathon deployment will not come close. */
const MAX_ESTATES = 100;

/**
 * Every estate opened against this deployment, newest first.
 *
 * Never resolves while `SUBGRAPH_URL` is unset: the explorer checks that first and says so, the
 * same way the activity feed does.
 */
export function useAllEstates(): Load<AllEstates> {
  const confirmed = useConfirmedBlock();

  const query = useQuery({
    // Keyed on the URL too, so pointing at a redeployed subgraph never shows the old one's cache.
    queryKey: ["subgraph", SUBGRAPH_URL, "allEstates"],
    queryFn: ({ signal }) => fetchAllEstates(MAX_ESTATES, signal),
    enabled: SUBGRAPH_URL !== undefined,
    refetchInterval: (current) => subgraphPollMs(current.state.data?.indexedBlock, confirmed),
  });

  const failed = failedLoad(query);
  if (failed) return failed;
  if (query.data === undefined) return LOADING;
  return ready(query.data);
}
