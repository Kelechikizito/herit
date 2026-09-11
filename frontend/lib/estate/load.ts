/**
 * The one state every chain read is folded into before a screen sees it.
 *
 * A disabled TanStack query stays `isPending` forever, so the raw query flags cannot tell "waiting
 * on an earlier read" from "loading". The read hooks derive this instead, and the cards branch on
 * it alone.
 */

type LoadError = { status: "error"; error: Error; retry: () => void };

export type Load<T> = { status: "loading" } | LoadError | { status: "ready"; data: T };

export const LOADING = { status: "loading" } as const;

export function ready<T>(data: T): Load<T> {
  return { status: "ready", data };
}

/** The first failed read, with a retry that re-runs every read that failed. */
export function failedLoad(
  ...queries: { error: Error | null; refetch: () => Promise<unknown> }[]
): LoadError | undefined {
  const failed = queries.filter((query) => query.error !== null);
  const first = failed[0];
  if (first === undefined || first.error === null) return undefined;

  return {
    status: "error",
    error: first.error,
    retry: () => {
      for (const query of failed) void query.refetch();
    },
  };
}

/**
 * What a load holds once ready. Matched on the ready variant alone: distributing over the whole
 * union would infer `unknown` from the loading and error variants and swallow the real type.
 */
type Data<L> = L extends { status: "ready"; data: infer T } ? T : never;

/**
 * Several loads as one, for a card that needs more than one read. Any error outranks loading, so a
 * failed read is reported rather than hidden behind a spinner waiting on it.
 */
export function all<const L extends readonly Load<unknown>[]>(
  ...loads: L
): Load<{ [K in keyof L]: Data<L[K]> }> {
  // Widened once, so the discriminant narrows on a concrete union rather than a type parameter.
  const list: readonly Load<unknown>[] = loads;

  const errors = list.filter((load): load is LoadError => load.status === "error");
  const first = errors[0];
  if (first !== undefined) {
    return {
      status: "error",
      error: first.error,
      retry: () => {
        for (const load of errors) load.retry();
      },
    };
  }

  const data: unknown[] = [];
  for (const load of list) {
    if (load.status !== "ready") return LOADING;
    data.push(load.data);
  }
  return ready(data as { [K in keyof L]: Data<L[K]> });
}
