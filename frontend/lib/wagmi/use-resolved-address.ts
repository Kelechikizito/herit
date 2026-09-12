"use client";

import { useEffect, useState } from "react";
import { type Address, isAddress, isAddressEqual, zeroAddress } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts/addresses";

/**
 * One address field's text, turned into an address.
 *
 * The forms accept either a literal `0x…` or an ENS name, because every heir Herit mints already
 * carries an `addr(60)` record — `son.alice.herit.eth` resolves to the same address the grantor
 * would otherwise paste. Resolution goes through the ENSv2 Universal Resolver pinned on the chain
 * object in `./chains`, which answers for the frozen hackathon deployment's namespace and nothing
 * else: a name in the regular Sepolia ENS deployment (`nick.eth`, `vitalik.eth`) lives under a
 * different root and comes back null here. So a name resolves for Herit exactly when it hangs off
 * the hackathon root — whoever registered it, Herit or not.
 *
 * Purely a read: nothing here decides whether an heir is valid. The forms still hand the address
 * this returns to `parseHeir`, which is what the contracts are actually checked against.
 */

export type Resolution =
  /** Nothing typed yet. */
  | { kind: "empty" }
  /** A literal address, checked the way `parseHeir` checks it. */
  | { kind: "address"; address: Address }
  /** A name is being looked up — either still debouncing, or the read is in flight. */
  | { kind: "resolving"; name: string }
  | { kind: "resolved"; name: string; address: Address }
  /** A well-formed name that the resolver did not answer for. */
  | { kind: "unresolved"; name: string; reason: string }
  /** Neither an address nor anything name-shaped. Left to `parseHeir` to word. */
  | { kind: "invalid" };

/** The address a resolution settled on, if it settled on one. */
export function resolvedAddress(resolution: Resolution): Address | undefined {
  if (resolution.kind === "address") return resolution.address;
  if (resolution.kind === "resolved") return resolution.address;
  return undefined;
}

/** True while a lookup is outstanding — the forms hold their submit until it lands. */
export function isPendingResolution(resolution: Resolution): boolean {
  return resolution.kind === "resolving";
}

/** Long enough that a pasted name reads as one keystroke, short enough to feel live. */
const DEBOUNCE_MS = 300;

export function useResolvedAddress(text: string): Resolution {
  const trimmed = text.trim();
  const settled = useDebounced(trimmed, DEBOUNCE_MS);

  const typed = classify(trimmed);
  // Only the settled text is ever sent, so a name is not looked up once per keystroke.
  const target = classify(settled);
  const name = target.kind === "name" && settled === trimmed ? target.name : undefined;

  const query = useEnsAddress({
    name,
    chainId: CHAIN_ID,
    query: { enabled: name !== undefined, staleTime: 60_000, retry: 1 },
  });

  if (typed.kind !== "name") return typed;

  // Either still debouncing — nothing sent for *this* text yet — or the read is in flight. A
  // background refetch is not "resolving": it still has the last answer for this name to show.
  if (name === undefined || query.isPending) {
    return { kind: "resolving", name: typed.name };
  }
  if (query.isError) {
    return { kind: "unresolved", name: typed.name, reason: "that name could not be looked up" };
  }
  const address = query.data ?? undefined;
  if (address === undefined || isAddressEqual(address, zeroAddress)) {
    return { kind: "unresolved", name: typed.name, reason: "that name has no address record" };
  }
  return { kind: "resolved", name: typed.name, address };
}

/*//////////////////////////////////////////////////////////////
                            INTERNALS
//////////////////////////////////////////////////////////////*/

/** The text alone, before any read: the three terminal cases, plus a name worth looking up. */
type Typed =
  | { kind: "empty" }
  | { kind: "address"; address: Address }
  | { kind: "invalid" }
  | { kind: "name"; name: string };

/**
 * What the text is, before anything is read. A name is normalised here rather than at the read,
 * because an unnormalised name hashes to a different node and would silently resolve elsewhere.
 */
function classify(text: string): Typed {
  if (text === "") return { kind: "empty" };

  if (text.toLowerCase().startsWith("0x")) {
    return isAddress(text) && !isAddressEqual(text, zeroAddress)
      ? { kind: "address", address: text }
      : { kind: "invalid" };
  }
  if (!text.includes(".")) return { kind: "invalid" };

  try {
    return { kind: "name", name: normalize(text) };
  } catch {
    return { kind: "invalid" };
  }
}

function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}
