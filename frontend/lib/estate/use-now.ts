"use client";

import { useSyncExternalStore } from "react";
import { nowSeconds } from "./format";

/**
 * One clock, shared by every subscriber.
 *
 * Module scope rather than per-hook, so two cards on the same screen can never tick a second
 * apart, and so a dashboard with six countdowns still runs one interval. The timer only exists
 * while something is watching it.
 */
let snapshot = nowSeconds();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    timer = setInterval(() => {
      const next = nowSeconds();
      // Only wake React when the second actually turns. `getSnapshot` has to be referentially
      // stable between real changes or the store re-renders forever.
      if (next !== snapshot) {
        snapshot = next;
        for (const l of listeners) l();
      }
    }, 1_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return snapshot;
}

/**
 * The current time in unix seconds, ticking once a second.
 *
 * `initialNow` is the server's timestamp, and it is what both the server render and the
 * hydrating client render return — React uses the server snapshot for hydration, then switches
 * to the live one immediately after. That is what keeps a countdown out of the hydration
 * mismatch warnings without any of the usual `mounted` flag ceremony.
 */
export function useNow(initialNow: number): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => initialNow);
}
