import { keccak256, toBytes } from "viem";

/**
 * Estate ids and heir labelhashes, derived from ENS labels.
 *
 * Both are `uint256(keccak256(bytes(label)))`, the value the gate computes from the label it is
 * given. Derive them here rather than accepting one from a caller: an id only means something as
 * the hash of a label.
 *
 * The World ID routes import this as well as the client, so the label a form accepts and the label
 * the server signs for cannot disagree.
 */

/**
 * A label Herit accepts: lowercase letters, digits and hyphens, 1 to 63 characters.
 *
 * Stricter than ENS on purpose. A label in this alphabet is already normalised, and hashing an
 * unnormalised label silently names something else.
 */
export const LABEL_PATTERN = /^[a-z0-9-]{1,63}$/;

export function isLabel(value: unknown): value is string {
  return typeof value === "string" && LABEL_PATTERN.test(value);
}

/** An estate's id: the labelhash of its name under `herit.eth`. */
export function estateIdOf(estateLabel: string): bigint {
  return labelhash(estateLabel);
}

/** An heir's key within its estate: the labelhash of the heir's subname label. */
export function heirLabelhashOf(heirLabel: string): bigint {
  return labelhash(heirLabel);
}

function labelhash(label: string): bigint {
  return BigInt(keccak256(toBytes(label)));
}
