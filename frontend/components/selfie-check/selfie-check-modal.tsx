"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IDKitRequestWidget, selfieCheckLegacy } from "@worldcoin/idkit";
import type { IDKitErrorCodes, IDKitDebugReport, IDKitResult } from "@worldcoin/idkit";

import { Star } from "@/components/ui/deco";
import { FieldRow } from "@/components/ui/data-row";
import { AlertIcon, CheckIcon, SelfieIcon, ShieldIcon } from "@/components/ui/icons";
import { StageList } from "@/components/ui/stage-list";
import {
  SELFIE_CHECK_STAGES,
  SUBMIT_STAGE,
  shortNonce,
  type SelfieCheckPurpose,
  type SignedAttestation,
  type SignResponse,
} from "@/lib/selfie-check";
import { type TxState, explorerTxUrl, pendingLabel } from "@/lib/wagmi/use-transaction";
import { useWallet } from "@/lib/wagmi/use-wallet";

/**
 * The Selfie Check modal.
 *
 * Two round trips to our own backend, with the World App in between:
 *
 *   1. `POST /api/worldid/sign`   — an RP signature, so IDKit will raise the check at all.
 *   2. the widget                 — the user proves liveness; we get a proof back.
 *   3. `POST /api/worldid/verify` — Cloud Verify, then an EIP-712 attestation.
 *
 * The attestation is handed to the caller, which sends the transaction. This component never
 * touches a wallet beyond reading the address the attestation must be bound to — but when the
 * caller passes that transaction's state back as `submission`, the modal stays open through the
 * wallet prompt and the receipt instead of closing on a check that has not landed yet.
 */

export type SelfieCheckProps = {
  open: boolean;
  purpose: SelfieCheckPurpose;
  onClose: () => void;
  /** Fired once, with the attestation the caller submits to `LivenessAttestor`. */
  onVerified?: (signed: SignedAttestation) => void;
  /** The transaction `onVerified` started. Adds a sixth stage that tracks it to confirmation. */
  submission?: TxState;
  /** Sends the same attestation again after a failed submission. It stays valid until it expires. */
  onResubmit?: (signed: SignedAttestation) => void;
  /** The close button's label once everything has finished. */
  confirmLabel?: string;
};

/**
 * Gate only. The dialog below owns all the run state, so every open starts from a fresh mount
 * rather than an effect resetting stale state back to zero.
 */
export function SelfieCheckModal({ open, ...props }: SelfieCheckProps) {
  if (!open) return null;
  return <SelfieCheckDialog {...props} />;
}

function SelfieCheckDialog({
  purpose,
  onClose,
  onVerified,
  submission,
  onResubmit,
  confirmLabel = "done",
}: Omit<SelfieCheckProps, "open">) {
  const { address } = useWallet();

  const [stage, setStage] = useState(0);
  const [config, setConfig] = useState<SignResponse | null>(null);
  const [signed, setSigned] = useState<SignedAttestation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stages = submission ? [...SELFIE_CHECK_STAGES, SUBMIT_STAGE] : SELFIE_CHECK_STAGES;
  // Past the five World ID stages: the attestation exists and has been handed over.
  const verified = stage >= SELFIE_CHECK_STAGES.length;
  const tx = verified ? submission : undefined;
  const txFailed = tx?.phase === "error";
  const current = tx?.phase === "success" ? stages.length : stage;
  const done = current >= stages.length;
  const failure = error ?? (txFailed ? (tx.error ?? "the transaction failed") : null);
  const txPending = tx !== undefined && !done && !txFailed;

  // Stage 1. The widget cannot mount before this resolves — `rp_context` is what proves the
  // request came from our registered RP, and it only exists once the server has signed it.
  useEffect(() => {
    let live = true;
    fetch("/api/worldid/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "could not start the check");
        return body as SignResponse;
      })
      .then((body) => {
        if (!live) return;
        setConfig(body);
        setStage(1);
      })
      .catch((cause: unknown) => {
        if (live) setError(messageFrom(cause, "could not reach the verification service"));
      });
    return () => {
      live = false;
    };
    // Once per mount: the dialog remounts on every open, and `purpose` is built inline by callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  /**
   * Stages 2 to 4. Throwing here rejects the verification inside IDKit, which is the point of
   * doing the backend call in `handleVerify` rather than in `onSuccess` — a proof our server
   * refuses must never reach the wallet.
   */
  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      if (!address) throw new Error("connect a wallet before verifying");
      setStage(2);

      const response = await fetch("/api/worldid/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `subject` is the address that will send the transaction. `LivenessAttestor._verify`
        // requires `a.subject == msg.sender`, so signing for anyone else reverts at the last step.
        body: JSON.stringify({ purpose, subject: address, result }),
      });
      setStage(3);

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "the proof was rejected");

      setSigned(body as SignedAttestation);
      setStage(4);
    },
    [address, purpose],
  );

  // Stage 5, and the hand-off. In an effect keyed on the transition rather than inside the
  // callback, so a re-render can never fire it twice.
  const handedOff = useRef(false);
  useEffect(() => {
    if (!signed || handedOff.current) return;
    handedOff.current = true;
    setStage(SELFIE_CHECK_STAGES.length);
    onVerified?.(signed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on completion only
  }, [signed]);

  // Not while the transaction is out: closing would hide a wallet prompt the user still has to
  // answer. Dismissing that prompt fails the submission, which makes the modal closable again.
  const closable = done || failure !== null;

  useEffect(() => {
    if (!closable) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closable, onClose]);

  const attestation = signed?.attestation;

  const title = failure
    ? txFailed
      ? "transaction failed"
      : "selfie check failed"
    : done
      ? submission
        ? "confirmed on sepolia"
        : "selfie check passed"
      : "selfie check";
  const body = failure
    ? failure
    : done
      ? submission
        ? "the transaction landed. the page updates on its own."
        : "the attestation is signed and ready to submit."
      : txPending
        ? submittingCopy(tx.phase)
        : "proving a unique, live human is behind this request.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="World ID Selfie Check"
    >
      {/* Mounted only once the request is signed, and only while the run is still going. */}
      {config && !signed && !error ? (
        <IDKitRequestWidget
          open
          onOpenChange={(next) => {
            // The user dismissed World App before a proof came back.
            if (!next && !signed) setError("the check was cancelled");
          }}
          app_id={config.app_id}
          // The server's string, never recomputed here: `signRequest` hashed this exact action
          // into the signature, and a byte of drift invalidates it.
          action={config.action}
          rp_context={config.rp_context}
          environment={config.environment}
          // Selfie Check is a World ID 3.0 credential — that is what "Legacy" means in the name.
          allow_legacy_proofs
          // The heir travels as the signal, not in the action string, so one human claiming two
          // heir slots gets the same nullifier both times. See checkpoint-10-guide.md §2.
          preset={selfieCheckLegacy(
            purpose.kind === "claim" ? { signal: purpose.heirLabel } : {},
          )}
          handleVerify={handleVerify}
          onSuccess={() => {}}
          onError={(code: IDKitErrorCodes, debugReport?: IDKitDebugReport) => {
            setError(errorMessage(code, config.environment));
            if (debugReport) console.error("[selfie-check]", debugReport);
          }}
        />
      ) : null}

      <div className="relative w-full max-w-md">
        <Star className="-left-4 -top-4 z-20" size={34} fill="#FFE566" rotate={-12} />

        <div className="card max-h-[88vh] overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <span
              className={`icon-box ${failure ? "bg-coral" : done ? "bg-teal" : "bg-lavender"}`}
            >
              {failure ? (
                <AlertIcon size={22} />
              ) : done ? (
                <CheckIcon size={22} />
              ) : (
                <SelfieIcon size={22} />
              )}
            </span>
            <div>
              <h2 className="text-xl">{title}</h2>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
            <FieldRow label="action" value={config?.action ?? "…"} />
            <FieldRow
              label="nonce"
              value={attestation ? shortNonce(toHex(attestation.nonce)) : "…"}
            />
            <FieldRow
              label="expiry"
              value={attestation ? expiresIn(attestation.expiry) : "…"}
            />
            {submission ? (
              <FieldRow label="transaction" value={tx?.hash ? shortNonce(tx.hash) : "…"} />
            ) : null}
          </div>

          <StageList
            stages={stages}
            current={current}
            failed={failure !== null}
            className="mt-5"
          />

          {done && attestation ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-[8px] border-2 border-ink bg-teal px-4 py-3">
              <ShieldIcon size={18} />
              <p className="text-xs font-medium leading-relaxed">
                this attestation is bound to <span className="mono">{config?.action}</span>, to
                one nonce, and to your address — it cannot be replayed against another estate or
                a different role.
              </p>
            </div>
          ) : null}

          {tx?.hash ? (
            <a
              href={explorerTxUrl(tx.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs font-bold underline decoration-2 underline-offset-4"
            >
              view the transaction on etherscan
            </a>
          ) : null}

          {txFailed && signed && onResubmit ? (
            <button
              type="button"
              className="btn btn-ghost mt-6 w-full"
              onClick={() => onResubmit(signed)}
            >
              send the same attestation again
            </button>
          ) : null}

          <button
            type="button"
            className={`btn w-full ${txFailed && onResubmit ? "mt-3" : "mt-6"}`}
            onClick={onClose}
            disabled={!closable}
          >
            {failure
              ? "close"
              : done
                ? confirmLabel
                : txPending
                  ? (pendingLabel(tx.phase) ?? "submitting…")
                  : "verifying…"}
          </button>
        </div>
      </div>
    </div>
  );
}

function submittingCopy(phase: TxState["phase"]): string {
  switch (phase) {
    case "awaiting-signature":
      return "the check passed. confirm the transaction in your wallet.";
    case "confirming":
      return "waiting for sepolia to include the transaction.";
    default:
      return "the check passed. making sure the transaction will go through.";
  }
}

/** A decimal uint256 back to hex, which is how a nonce is read off a screen. */
function toHex(decimal: string): string {
  return `0x${BigInt(decimal).toString(16).padStart(64, "0")}`;
}

function expiresIn(expiry: string): string {
  const seconds = Number(expiry) - Math.floor(Date.now() / 1000);
  return seconds > 0 ? `in ${Math.ceil(seconds / 60)} min` : "expired";
}

function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** Failures the user can act on, rather than a spinner that never stops. */
function errorMessage(code: IDKitErrorCodes, environment: string): string {
  switch (code) {
    case "user_rejected":
    case "verification_rejected":
      return "the check was declined in World App";
    case "credential_unavailable":
    case "feature_unavailable":
    case "world_id_3_not_available":
      return "selfie check is not enabled for this app — a portal setting, not a retry";
    case "nullifier_replayed":
      return "this human has already used a check here";
    case "max_verifications_reached":
      return "no verifications left for this action";
    case "invalid_rp_signature":
    case "rp_signature_expired":
    case "timestamp_too_old":
      return "the signed request expired before you finished — start again";
    case "unknown_rp":
    case "inactive_rp":
      return `this app is not registered in the ${environment} environment`;
    case "invalid_network":
      return `wrong network for the ${environment} environment`;
    case "connection_failed":
      return "could not reach World App — check the connection and try again";
    default:
      return `world id could not complete the check (${code})`;
  }
}
