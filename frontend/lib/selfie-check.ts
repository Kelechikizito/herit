import type { RpContext } from "@worldcoin/idkit";

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
    { label: "opening World App", detail: "signed request raised with IDKit" },
    { label: "capturing liveness", detail: "orb or device selfie check" },
    { label: "verifying proof", detail: "World ID Cloud Verify" },
    {
      label: "signing attestation",
      detail: "EIP-712, scoped to action + nonce",
    },
    { label: "ready to submit", detail: "LivenessAttestor.checkIn / claim" },
  ];

/** The three environments a World ID app can be pointed at. */
export const WLD_ENVIRONMENTS = ["production", "staging", "sandbox"] as const;
export type WldEnvironment = (typeof WLD_ENVIRONMENTS)[number];

/** What `POST /api/worldid/sign` returns. */
export type SignResponse = {
  app_id: `app_${string}`;
  action: string;
  environment: WldEnvironment;
  rp_context: RpContext;
};

/**
 * What `POST /api/worldid/verify` returns.
 *
 * The three uint256 fields are decimal strings — they do not survive JSON as numbers. Convert
 * with `BigInt(...)` on the way to the wallet.
 */
export type SignedAttestation = {
  attestation: {
    estateId: string;
    subject: `0x${string}`;
    action: `0x${string}`;
    heirLabelhash: string;
    commitment: `0x${string}`;
    nonce: string;
    expiry: string;
  };
  signature: `0x${string}`;
};

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

/** 32 bytes do not fit in the modal. Enough of both ends to read it off a screen recording. */
export function shortNonce(nonce: string): string {
  return `${nonce.slice(0, 10)}…${nonce.slice(-6)}`;
}
