import { parseAbi } from "viem";

// Handwritten, unlike the generated `*.abi.ts` files beside it: only the ENSv2 fragments Herit
// reads, checked against `lib/contracts-v2/contracts/src`.

/**
 * Registry A, the `PermissionedRegistry` holding each grantor's name under `herit.eth`.
 *
 * Neither reverts on an unknown id. `getOwner` reads zero for a name never registered *or* expired.
 * `getExpiry` reads zero only for one never registered; an expired name keeps its past timestamp.
 */
export const grantorRegistryAbi = parseAbi([
  "function getOwner(uint256 anyId) view returns (address)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
]);

/** ENSv2's shared label database. Reads `""` for a labelhash no registry has stored. */
export const labelStoreAbi = parseAbi(["function getLabel(uint256 anyId) view returns (string)"]);
