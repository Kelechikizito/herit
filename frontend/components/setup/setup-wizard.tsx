"use client";

import { useState } from "react";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { Stepper } from "@/components/setup/stepper";
import { ClockStep } from "@/components/setup/steps/clock-step";
import { FundStep } from "@/components/setup/steps/fund-step";
import { HeirsStep } from "@/components/setup/steps/heirs-step";
import { NameStep } from "@/components/setup/steps/name-step";
import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";
import { SETUP_STEPS } from "@/lib/content/setup";
import { labelProblem, parseDeposit, timerProblem } from "@/lib/estate";
import { useLabelCheck, useSetupLimits, useSetupProgress } from "@/lib/estate/use-setup";
import { useSetupDraft } from "@/lib/estate/use-setup-draft";
import { useWallet } from "@/lib/wagmi/use-wallet";

const AMOUNT_PROBLEM = "enter the deposit as a number, like 0.5";

/**
 * The setup flow. Holds the draft (in `localStorage`, via `useSetupDraft`) and every chain read
 * the steps validate against, then hands over to the checklist that sends it.
 */
export function SetupWizard() {
  const [draft, dispatch] = useSetupDraft();
  const [step, setStep] = useState(0);
  const { address } = useWallet();

  const limits = useSetupLimits();
  const check = useLabelCheck(draft.label, address);
  const progress = useSetupProgress(draft, address);

  if (draft.running) {
    return <SetupChecklist draft={draft} progress={progress} dispatch={dispatch} />;
  }

  const minted = new Set(
    progress.status === "ready"
      ? draft.heirs.filter((_, i) => progress.data.heirsRegistered[i]).map((heir) => heir.label)
      : [],
  );

  // The token's real decimals once progress has read them; ETH's 18 until then, which only
  // rejects text that is not a number at all.
  const amountProblem =
    progress.status === "ready"
      ? progress.data.depositAmount === undefined
        ? AMOUNT_PROBLEM
        : undefined
      : parseDeposit(draft.deposit.amount, 18) === undefined
        ? AMOUNT_PROBLEM
        : undefined;

  const problems = [
    labelProblem(draft.label),
    check.kind === "taken" ? `${draft.label}.herit.eth is already taken` : undefined,
    limits.status === "ready"
      ? timerProblem(draft.intervalSeconds, draft.graceSeconds, limits.data)
      : undefined,
    amountProblem,
    address === undefined ? "connect the wallet that will own the estate" : undefined,
  ].filter((problem): problem is string => problem !== undefined);
  const ready = problems.length === 0 && (check.kind === "available" || check.kind === "yours");

  const last = step === SETUP_STEPS.length - 1;

  return (
    <>
      <Stepper current={step} onJump={setStep} />

      <div className="card mt-6 p-6 sm:p-8">
        {step === 0 ? (
          <NameStep
            label={draft.label}
            onLabel={(label) => dispatch({ type: "label", label })}
            check={check}
          />
        ) : step === 1 ? (
          <ClockStep
            intervalSeconds={draft.intervalSeconds}
            graceSeconds={draft.graceSeconds}
            limits={limits}
            onInterval={(seconds) => dispatch({ type: "interval", seconds })}
            onGrace={(seconds) => dispatch({ type: "grace", seconds })}
          />
        ) : step === 2 ? (
          <HeirsStep
            estateLabel={draft.label}
            heirs={draft.heirs}
            minted={minted}
            maxHeirs={limits.status === "ready" ? limits.data.maxHeirs : Number.POSITIVE_INFINITY}
            onAdd={(heir) => dispatch({ type: "add-heir", heir })}
            onRemove={(label) => dispatch({ type: "remove-heir", label })}
          />
        ) : (
          <FundStep
            draft={draft}
            amountProblem={amountProblem}
            onAsset={(asset) => dispatch({ type: "deposit-asset", asset })}
            onAmount={(amount) => dispatch({ type: "deposit-amount", amount })}
          />
        )}
      </div>

      {last && problems.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {problems.map((problem) => (
            <li key={problem} className="flex items-start gap-2 text-xs font-bold text-muted">
              <AlertIcon size={15} />
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          back
        </button>

        {last ? (
          <button
            type="button"
            className="btn btn-pill"
            onClick={() => dispatch({ type: "run", running: true })}
            disabled={!ready}
          >
            {check.kind === "yours" ? "continue setup" : "open the estate"}
            <ArrowRightIcon size={16} />
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setStep((current) => current + 1)}>
            continue
            <ArrowRightIcon size={16} />
          </button>
        )}
      </div>
    </>
  );
}
