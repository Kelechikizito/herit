/**
 * The World ID Selfie Check vocabulary.
 *
 * The stages mirror the real path in ARCHITECTURE.md §5: MiniKit raises the verification, World ID
 * produces a liveness and uniqueness proof, the herit backend checks it against Cloud Verify, signs
 * an EIP-712 attestation scoped to one action and nonce, and `LivenessAttestor` on Sepolia verifies
 * that signature before touching `HeritRegistry`.
 *
 * `actionString` is the field the attestation actually carries, so replacing the simulated run with
 * a fetch does not change the shape of anything here.
 */

/** What a given check is being performed for. Scoping is what stops a check-in replaying as a claim. */
export type SelfieCheckPurpose =
  | { kind: "checkin"; estateLabel: string }
  | { kind: "claim"; estateLabel: string; heirLabel: string };

export const SELFIE_CHECK_STAGES: readonly { label: string; detail: string }[] = [
  { label: "opening World App", detail: "MiniKit verify command raised" },
  { label: "capturing liveness", detail: "orb or device selfie check" },
  { label: "verifying proof", detail: "World ID Cloud Verify" },
  { label: "signing attestation", detail: "EIP-712, scoped to action + nonce" },
  { label: "submitting to Sepolia", detail: "LivenessAttestor.verify()" },
];

/** How long each simulated stage holds, in milliseconds. */
export const STAGE_MS = 620;

/** The attestation's `action` field. */
export function actionString(purpose: SelfieCheckPurpose): string {
  return purpose.kind === "checkin"
    ? `checkin:${purpose.estateLabel}`
    : `claim:${purpose.estateLabel}:${purpose.heirLabel}`;
}

/** A fresh nonce per attempt — showing it makes the replay protection concrete. */
export function randomNonce(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}
