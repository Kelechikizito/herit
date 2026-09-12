/**
 * A typed POST against the herit subgraph.
 *
 * No GraphQL library: the app sends one query, and TanStack Query — already here for wagmi — owns
 * the caching, polling and retries.
 */

/**
 * Studio's development query URL for the `herit` subgraph. Unset leaves the activity feed
 * disconnected rather than broken: every other card reads the chain directly.
 */
export const SUBGRAPH_URL: string | undefined = process.env.NEXT_PUBLIC_SUBGRAPH_URL || undefined;

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function querySubgraph<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (SUBGRAPH_URL === undefined) {
    throw new Error("the activity feed is not connected: NEXT_PUBLIC_SUBGRAPH_URL is unset");
  }

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (response.status === 429) {
    throw new Error("the indexer is rate-limiting this app — studio's daily query allowance is spent");
  }
  if (!response.ok) {
    throw new Error(`the indexer answered ${response.status} ${response.statusText}`.trim());
  }

  // graph-node reports query errors with a 200, so the body decides.
  const body = (await response.json()) as GraphQLResponse<T>;
  const first = body.errors?.[0];
  if (first !== undefined) throw new Error(`the indexer refused the query: ${first.message}`);
  if (body.data === undefined) throw new Error("the indexer returned no data");
  return body.data;
}
