import type { Hash } from "viem";

/**
 * Sepolia Etherscan links.
 *
 * Kept out of `use-transaction.ts`, which is a `"use client"` module: server components on the
 * landing page link contract addresses too, and a client module's exports are not callable during
 * a server render. `use-transaction.ts` re-exports both, so client call sites are unaffected.
 */
const EXPLORER = "https://sepolia.etherscan.io";

export function explorerTxUrl(hash: Hash): string {
  return `${EXPLORER}/tx/${hash}`;
}

/** Takes a plain string, like `shortAddress`, so a caller need not narrow to `Address` first. */
export function explorerAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
