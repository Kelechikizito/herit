"use client";

import { useState } from "react";

/** A value's most recent change while the component reading it has been mounted. */
export type Change<T> = {
  from: T;
  to: T;
  /** Counts changes, so an element keyed on it remounts and replays its animation on each. */
  seq: number;
};

/**
 * The last change to `value` seen while this component was on screen, or undefined if none.
 *
 * For state that moves without the viewer doing anything — a poll that brings `canClaim` back
 * true, an estate sliding into grace — so the screen can mark the moment instead of silently
 * re-rendering. The value a component mounts with is never a change, so a page opened after the
 * fact stays still.
 *
 * The previous value lives in state and is compared during render: React's pattern for deriving
 * from a value's last render, with no effect and no ref, and the re-render lands before commit.
 * Compared with `Object.is`, so pass primitives.
 */
export function useChange<T>(value: T): Change<T> | undefined {
  const [seen, setSeen] = useState(value);
  const [change, setChange] = useState<Change<T>>();

  if (!Object.is(seen, value)) {
    setSeen(value);
    setChange({ from: seen, to: value, seq: (change?.seq ?? 0) + 1 });
  }

  return change;
}
