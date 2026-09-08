"use client";

import { useState } from "react";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { Stepper } from "@/components/setup/stepper";
import { ClockStep } from "@/components/setup/steps/clock-step";
import { FundStep } from "@/components/setup/steps/fund-step";
import { HeirsStep } from "@/components/setup/steps/heirs-step";
import { NameStep } from "@/components/setup/steps/name-step";
import { ArrowRightIcon, SelfieIcon } from "@/components/ui/icons";
import { SETUP_DEFAULTS, SETUP_STEPS } from "@/lib/content/setup";

/** The four steps, in order. Index matches `SETUP_STEPS`. */
const STEP_VIEWS = [NameStep, ClockStep, HeirsStep, FundStep] as const;

/**
 * The setup flow's only stateful piece: which step is showing, and whether the closing Selfie
 * Check is running. Everything it renders is presentational.
 */
export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [opening, setOpening] = useState(false);

  const StepView = STEP_VIEWS[step];
  const last = step === SETUP_STEPS.length - 1;

  return (
    <>
      <Stepper current={step} onJump={setStep} />

      <div className="card mt-6 p-6 sm:p-8">
        <StepView />
      </div>

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
          <button type="button" className="btn btn-pill" onClick={() => setOpening(true)}>
            <SelfieIcon size={17} />
            selfie check and open
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => setStep((current) => current + 1)}
          >
            continue
            <ArrowRightIcon size={16} />
          </button>
        )}
      </div>

      <SelfieCheckModal
        open={opening}
        purpose={{ kind: "checkin", estateLabel: SETUP_DEFAULTS.estateLabel }}
        onClose={() => setOpening(false)}
        confirmLabel="open the estate"
      />
    </>
  );
}
