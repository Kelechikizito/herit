"use client";

import { useCallback } from "react";
import { contracts } from "@/lib/contracts/contracts";
import type { SelfieCheckPurpose, SignedAttestation } from "@/lib/selfie-check";
import { useTransaction } from "./use-transaction";

/**
 * A passed Selfie Check, sent straight to `LivenessAttestor`.
 *
 * Hand `submit` to the modal's `onVerified` and `submission` to its `submission` prop. The
 * attestation expires five minutes after signing, so it goes out the moment it arrives rather than
 * waiting on a second click.
 */
export function useAttestedAction(kind: SelfieCheckPurpose["kind"]) {
  const { send, reset, phase, error, hash, busy, blocked } = useTransaction();

  const submit = useCallback(
    (signed: SignedAttestation) => {
      const { attestation, signature } = signed;
      // The route sends the uint256 fields as decimal strings; JSON has no bigint.
      const a = {
        estateId: BigInt(attestation.estateId),
        subject: attestation.subject,
        action: attestation.action,
        heirLabelhash: BigInt(attestation.heirLabelhash),
        commitment: attestation.commitment,
        nonce: BigInt(attestation.nonce),
        expiry: BigInt(attestation.expiry),
      };

      return kind === "checkin"
        ? send({ ...contracts.livenessAttestor, functionName: "checkIn", args: [a, signature] })
        : send({ ...contracts.livenessAttestor, functionName: "claim", args: [a, signature] });
    },
    [kind, send],
  );

  return { submit, submission: { phase, error, hash }, busy, blocked, reset };
}
