"use client";

import { useEffect, useState } from "react";
import { Star } from "@/components/ui/deco";
import { FieldRow } from "@/components/ui/data-row";
import { CheckIcon, SelfieIcon, ShieldIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import {
  actionString,
  randomNonce,
  SELFIE_CHECK_STAGES,
  STAGE_MS,
  type SelfieCheckPurpose,
} from "@/lib/selfie-check";

/**
 * The Selfie Check modal.
 *
 * Walks the five stages of the World ID path — see `lib/selfie-check.ts` for what each one maps to
 * on the real path. The stages advance on a timer because the backend is not wired yet; the action
 * string, nonce and expiry shown are the exact fields the attestation will carry, so replacing the
 * timer with a fetch does not change this component's shape.
 */

export type SelfieCheckProps = {
  open: boolean;
  purpose: SelfieCheckPurpose;
  onClose: () => void;
  /** Fired once, when the last stage clears. */
  onVerified?: () => void;
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
  confirmLabel = "done",
}: Omit<SelfieCheckProps, "open">) {
  const [stage, setStage] = useState(0);
  // A nonce is minted per attempt; showing it makes the replay protection concrete.
  const [nonce] = useState(randomNonce);

  const action = actionString(purpose);
  const done = stage >= SELFIE_CHECK_STAGES.length;

  useEffect(() => {
    const timers = SELFIE_CHECK_STAGES.map((_, index) =>
      window.setTimeout(() => setStage(index + 1), (index + 1) * STAGE_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Signal the caller once the last stage clears, in an effect keyed on the transition rather
  // than inside the timer, so a re-render can never fire it twice.
  useEffect(() => {
    if (done) onVerified?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on completion only
  }, [done]);

  useEffect(() => {
    if (!done) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [done, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="World ID Selfie Check"
    >
      <div className="relative w-full max-w-md">
        <Star className="-left-4 -top-4 z-20" size={34} fill="#FFE566" rotate={-12} />

        <div className="card max-h-[88vh] overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <span className={`icon-box ${done ? "bg-teal" : "bg-lavender"}`}>
              {done ? <CheckIcon size={22} /> : <SelfieIcon size={22} />}
            </span>
            <div>
              <h2 className="text-xl">{done ? "selfie check passed" : "selfie check"}</h2>
              <p className="mt-1 text-sm text-muted">
                {done
                  ? "the attestation was accepted on Sepolia."
                  : "proving a unique, live human is behind this request."}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
            <FieldRow label="action" value={action} />
            <FieldRow label="nonce" value={`0x${nonce}`} />
            <FieldRow label="expiry" value="+10 minutes" />
          </div>

          <StageList current={stage} />

          {done ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-[8px] border-2 border-ink bg-teal px-4 py-3">
              <ShieldIcon size={18} />
              <p className="text-xs font-medium leading-relaxed">
                this proof is bound to <span className="mono">{action}</span> and cannot be
                replayed against another estate or a different role.
              </p>
            </div>
          ) : null}

          <button type="button" className="btn mt-6 w-full" onClick={onClose} disabled={!done}>
            {done ? confirmLabel : "verifying…"}
          </button>

          <p className="mt-3 text-center text-[0.7rem] text-muted">
            demo build — the verification sequence is simulated while the attestor backend is
            wired up.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The five stages, ticked off as the run progresses. */
function StageList({ current }: { current: number }) {
  return (
    <ol className="mt-5 space-y-2.5">
      {SELFIE_CHECK_STAGES.map((entry, index) => {
        const state = current > index ? "done" : current === index ? "active" : "pending";
        return (
          <li key={entry.label} className="flex items-center gap-3">
            <IconCircle
              size="sm"
              accent={
                state === "done"
                  ? "bg-teal"
                  : state === "active"
                    ? "bg-yellow pulse-dot"
                    : "bg-surface"
              }
            >
              {state === "done" ? (
                <CheckIcon size={14} />
              ) : (
                <span className="mono text-[0.65rem] font-bold">{index + 1}</span>
              )}
            </IconCircle>
            <div className="min-w-0">
              <p
                className={`text-sm font-bold ${
                  state === "pending" ? "text-muted" : "text-ink"
                }`}
              >
                {entry.label}
              </p>
              <p className="truncate text-[0.72rem] text-muted">{entry.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
