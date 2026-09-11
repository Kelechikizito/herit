"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type SetupAction, type SetupDraft, parseStoredDraft, setupReducer } from "./setup";

/**
 * The setup draft, kept in `localStorage` so a reload mid-setup keeps what was typed.
 *
 * Only the inputs live here. Whether each step has been sent is always read back from the chain
 * (`useSetupProgress`), never stored — a stored "done" flag is exactly what goes stale when a
 * transaction is dismissed or replaced.
 *
 * An external store rather than state plus an effect: the server renders the empty draft, the
 * client hydrates with that same snapshot, then switches to the stored one without a mismatch.
 */

const KEY = "herit:setup-draft";
const listeners = new Set<() => void>();

/**
 * This tab's latest write. Undefined until the first one, after which it outranks storage — so a
 * browser that refuses `localStorage` still gets a working form, just not one that survives reload.
 */
let memory: string | null | undefined;

function readSnapshot(): string | null {
  if (memory !== undefined) return memory;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(next: string | null) {
  memory = next;
  try {
    if (next === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // Private mode or blocked storage: the in-memory copy carries this tab.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSetupDraft(): [SetupDraft, (action: SetupAction) => void] {
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => null);
  const draft = useMemo(() => parseStoredDraft(raw), [raw]);

  const dispatch = useCallback((action: SetupAction) => {
    if (action.type === "clear") {
      write(null);
      return;
    }
    write(JSON.stringify(setupReducer(parseStoredDraft(readSnapshot()), action)));
  }, []);

  return [draft, dispatch];
}
