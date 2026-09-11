"use client";

import { useCallback } from "react";
import { contracts } from "@/lib/contracts/contracts";
import {
  type SelfieCheckPurpose,
  type SignedAttestation,
  toAttestationArgs,
} from "@/lib/selfie-check";
import { useTransaction } from "./use-transaction";

/**
 * A passed Selfie Check, sent straight to `LivenessAttestor`.
 *
 * Hand `submit` to the modal's `onVerified` and `submission` to its `submission` prop. The
 * attestation expires well before the hour is out, so it goes out the moment it arrives rather than
 * waiting on a second click.
 */
export function useAttestedAction(kind: SelfieCheckPurpose["kind"]) {
  const { send, reset, phase, error, hash, busy, blocked } = useTransaction();

  const submit = useCallback(
    (signed: SignedAttestation) => {
      const attestation = toAttestationArgs(signed);

      return kind === "checkin"
        ? send({
            ...contracts.livenessAttestor,
            functionName: "checkIn",
            args: [attestation, signed.signature],
          })
        : send({
            ...contracts.livenessAttestor,
            functionName: "claim",
            args: [attestation, signed.signature],
          });
    },
    [kind, send],
  );

  return { submit, submission: { phase, error, hash }, busy, blocked, reset };
}
