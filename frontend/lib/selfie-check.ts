/**
 * The World ID Selfie Check vocabulary.
 *
 * The stages mirror the real path in ARCHITECTURE.md §5: MiniKit raises the verification, World ID
 * produces a liveness and uniqueness proof, the herit backend checks it against Cloud Verify, signs
 * an EIP-712 attestation scoped to one action and nonce, and `LivenessAttestor` on Sepolia verifies
 * that signature before touching `HeritRegistry`.
 *
 * `actionString` is the World ID action — the string that scopes the nullifier — not the
 * attestation's `action` field, which is a bytes32 constant the contract compares. The two are
 * different things with the same name; see documents/checkpoint-10-guide.md §2.
 */

/** What a given check is being performed for. `heirLabel` travels as the proof's signal, not in the action. */
export type SelfieCheckPurpose =
  | { kind: "checkin"; estateLabel: string }
  | { kind: "claim"; estateLabel: string; heirLabel: string };

export const SELFIE_CHECK_STAGES: readonly { label: string; detail: string }[] =
  [
    { label: "opening World App", detail: "MiniKit verify command raised" },
    { label: "capturing liveness", detail: "orb or device selfie check" },
    { label: "verifying proof", detail: "World ID Cloud Verify" },
    {
      label: "signing attestation",
      detail: "EIP-712, scoped to action + nonce",
    },
    { label: "submitting to Sepolia", detail: "LivenessAttestor.verify()" },
  ];

/** How long each simulated stage holds, in milliseconds. */
export const STAGE_MS = 620;

/**
 * The World ID action, which scopes the nullifier. One per estate, shared by both purposes.
 *
 * Same human, same estate, same nullifier — whether they are checking in or claiming. That is
 * what lets `LivenessAttestor.claim` reject a grantor claiming from their own estate, since it
 * compares the claim commitment against the one the first check-in bound. Splitting this into
 * `checkin:` and `claim:` would hand the same person two unlinkable nullifiers and turn that
 * check into dead code. Check-in and claim stay separate on-chain through the attestation's own
 * `action` field, which the backend sets and `LivenessAttestor` enforces.
 */
export function actionString(purpose: SelfieCheckPurpose): string {
  return `herit:${purpose.estateLabel}`;
}

/**
 * A fresh attestation nonce: a full 256-bit value, 0x-prefixed.
 *
 * `LivenessAttestor` keys its used-nonce mapping on a `uint256` shared by every estate and every
 * user, so this has to be wide enough that two people never collide — a collision reverts the
 * second person's check-in with `NonceUsed`. `BigInt(randomNonce())` is what goes into the
 * attestation. Browser and Node both provide `crypto.getRandomValues`; `Math.random` is not a
 * source of randomness anything should rely on.
 */
export function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** 32 bytes do not fit in the modal. Enough of both ends to read it off a screen recording. */
export function shortNonce(nonce: string): string {
  return `${nonce.slice(0, 10)}…${nonce.slice(-6)}`;
}
