"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { TxStatus } from "@/components/estate/tx-status";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { AlertIcon, ArrowRightIcon, CheckIcon, SelfieIcon, TreeIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import { AlertNote } from "@/components/ui/note";
import { StageList } from "@/components/ui/stage-list";
import type { ContractCall } from "@/lib/contracts/call";
import { describeError } from "@/lib/contracts/errors";
import {
  type Load,
  type SetupAction,
  type SetupDraft,
  estateHref,
  fullName,
  nowSeconds,
} from "@/lib/estate";
import { type SetupStep, checkInCall, estateExpiryFor, planSetup } from "@/lib/estate/setup-plan";
import type { SetupProgress } from "@/lib/estate/use-setup";
import type { SignedAttestation } from "@/lib/selfie-check";
import {
  type BatchMode,
  type BatchState,
  useBatchTransaction,
} from "@/lib/wagmi/use-batch-transaction";
import { pendingLabel } from "@/lib/wagmi/use-transaction";
import { useWallet } from "@/lib/wagmi/use-wallet";

/**
 * Setup, sent. One click sends every step the chain has not seen yet, in the only order the
 * contracts accept: `openEstate` → `configure` → `registerHeir` per heir → `approve` → deposit →
 * `checkIn`.
 *
 * A wallet that can batch signs all of it once and it lands in a single transaction; any other
 * wallet is asked once per step, each waiting for the last receipt. The Selfie Check goes first
 * either way, because its attestation is what the last call carries.
 *
 * Each tick comes from `useSetupProgress`, which reads the chain. Nothing is marked done because
 * something was sent — only because Sepolia says so — so a reload lands on the right step, and no
 * step is ever offered twice.
 */

/** An attestation with less than this left is not reused: the run still has to be signed and mined. */
const ATTESTATION_MARGIN_SECONDS = 3 * 60;

/** One click's worth of sending, fixed when the button is pressed so the stages cannot shift under it. */
type Run = {
  mode: BatchMode;
  /** Whether this run opens with a Selfie Check, or spends an attestation already in hand. */
  selfie: boolean;
  /** The pending steps, in the order they are sent. */
  titles: string[];
  /** Every call but the check-in, which is built once the attestation arrives. */
  calls: ContractCall[];
  needsCheckIn: boolean;
};

export function SetupChecklist({
  draft,
  progress,
  dispatch,
}: {
  draft: SetupDraft;
  progress: Load<SetupProgress> & { fetching: boolean };
  dispatch: (action: SetupAction) => void;
}) {
  const { address } = useWallet();
  const batch = useBatchTransaction();
  const [run, setRun] = useState<Run | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  /** The last attestation this session produced, so a dismissed prompt does not cost another face scan. */
  const held = useRef<SignedAttestation | undefined>(undefined);

  const busy = batch.busy || verifying || preparing;

  const back = (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => dispatch({ type: "run", running: false })}
      disabled={busy}
    >
      back to the draft
    </button>
  );

  const heading = (
    <CardHeading
      size="lg"
      icon={TreeIcon}
      accent="bg-lavender"
      title={`opening ${fullName(draft)}`}
      body="one click sends every step. a wallet that can batch signs once and they land together; any other signs them in turn. every tick is read back from sepolia, so you can close this tab and pick up exactly where you left off."
    />
  );

  if (address === undefined) {
    return (
      <Frame heading={heading} footer={back}>
        <AlertNote>connect the wallet that will own the estate to send these.</AlertNote>
      </Frame>
    );
  }

  if (progress.status !== "ready") {
    return (
      <Frame heading={heading} footer={back}>
        {progress.status === "loading" ? (
          <p className="text-sm text-muted">reading sepolia…</p>
        ) : (
          <>
            <AlertNote>{describeError(progress.error)}</AlertNote>
            <button type="button" className="btn btn-sm mt-4" onClick={progress.retry}>
              try again
            </button>
          </>
        )}
      </Frame>
    );
  }

  const p = progress.data;
  const grantor = address;
  // For display only. The expiry that actually goes on-chain is read in `start`, where the clock
  // may be read: before the estate exists this one is zero.
  const steps = planSetup(draft, p, grantor, p.estateExpiry);
  const pending = steps.filter((step) => !step.done);
  const next = pending[0];
  const needsSelfie = pending.some((step) => step.call === undefined);

  const blocked = p.opened
    ? p.depositAmount === undefined
      ? "the deposit amount is not a number — go back to the draft and fix it"
      : undefined
    : p.blocked;

  async function start() {
    // Planned before anything is awaited, so a slow capability check cannot shift the list underneath.
    const expiry = estateExpiryFor(p);
    const sending = planSetup(draft, p, grantor, expiry).filter((step) => !step.done);
    const calls = sending
      .map((step) => step.call)
      .filter((call): call is ContractCall => call !== undefined);
    const needsCheckIn = sending.some((step) => step.call === undefined);
    const attestation = held.current;
    const reusable = attestation !== undefined && stillUsable(attestation, p.estateId, grantor);

    setPreparing(true);
    let mode: BatchMode;
    try {
      mode = await batch.detectMode();
    } finally {
      setPreparing(false);
    }

    batch.reset();
    const started: Run = {
      mode,
      selfie: needsCheckIn && !reusable,
      titles: sending.map((step) => step.title),
      calls,
      needsCheckIn,
    };
    setRun(started);

    if (started.selfie) {
      setVerifying(true);
      return;
    }
    void batch.send(
      needsCheckIn && attestation ? [...calls, checkInCall(attestation)] : calls,
      mode,
    );
  }

  return (
    <Frame heading={heading} footer={back}>
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <StepRow key={step.key} step={step} index={index} current={step === next} />
        ))}
      </ol>

      {run ? <RunPanel run={run} batch={batch} /> : null}

      {next === undefined ? (
        <div className="mt-6">
          <div className="flex items-start gap-2.5 rounded-[10px] border-2 border-ink bg-teal px-5 py-4">
            <CheckIcon size={18} />
            <div>
              <p className="text-sm font-bold">{fullName(draft)} is live</p>
              <p className="mt-1 text-xs leading-relaxed">
                the clock is running. check in before the window closes, or your heirs inherit.
              </p>
            </div>
          </div>
          <Link
            href={estateHref("/dashboard", draft.label)}
            className="btn mt-5"
            onClick={() => dispatch({ type: "clear" })}
          >
            go to the dashboard
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          {blocked ? (
            <p className="mb-3 flex items-start gap-2 text-xs font-bold text-coral" role="alert">
              <AlertIcon size={15} />
              {blocked}
            </p>
          ) : null}
          <button
            type="button"
            className={needsSelfie ? "btn btn-pill w-full" : "btn w-full"}
            onClick={() => void start()}
            disabled={
              busy || progress.fetching || blocked !== undefined || batch.blocked !== undefined
            }
          >
            {needsSelfie ? <SelfieIcon size={17} /> : null}
            {preparing
              ? "checking what your wallet can do…"
              : verifying
                ? "selfie check in progress…"
                : batch.busy
                  ? busyLabel(run, batch)
                  : progress.fetching
                    ? "reading sepolia…"
                    : batch.phase === "error"
                      ? "pick up where it stopped"
                      : p.opened
                        ? "continue setup"
                        : `open ${fullName(draft)}`}
          </button>
          {batch.blocked ? <p className="hint text-center">{batch.blocked}</p> : null}
          <TxStatus tx={batch} success="every step confirmed on sepolia" className="mt-3" />
        </div>
      )}

      <SelfieCheckModal
        open={verifying}
        purpose={{ kind: "checkin", estateLabel: draft.label, setup: true }}
        onClose={() => {
          setVerifying(false);
          // Nothing was sent, so there is no run left to report on.
          if (batch.phase === "idle") setRun(undefined);
        }}
        onVerified={(attestation) => {
          held.current = attestation;
          setVerifying(false);
          // Straight on to the wallet: the attestation is already ticking.
          if (run) void batch.send([...run.calls, checkInCall(attestation)], run.mode);
        }}
        confirmLabel="done"
      />
    </Frame>
  );
}

/** One step of setup, ticked when the chain says so and highlighted while it is the one in hand. */
function StepRow({ step, index, current }: { step: SetupStep; index: number; current: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-[8px] border-2 border-ink px-4 py-3 ${
        step.done ? "bg-cream" : current ? "bg-yellow shadow-brut" : "bg-surface"
      }`}
    >
      <IconCircle size="sm" accent={step.done ? "bg-teal" : "bg-surface"}>
        {step.done ? (
          <CheckIcon size={14} />
        ) : (
          <span className="mono text-[0.65rem] font-bold">{index + 1}</span>
        )}
      </IconCircle>
      <div className="min-w-0">
        <p className={`truncate text-sm font-bold ${step.done || current ? "" : "text-muted"}`}>
          {step.title}
        </p>
        <p className="truncate text-[0.72rem] text-muted">{step.detail}</p>
      </div>
    </li>
  );
}

/** How far the run has got, and what it is doing. */
function RunPanel({ run, batch }: { run: Run; batch: BatchState }) {
  const stages = runStages(run, batch);
  const done = Math.min(stagesDone(run, batch), stages.length);
  const failed = batch.phase === "error";
  const percent = Math.round((done / stages.length) * 100);
  const atomic = (batch.mode ?? run.mode) === "atomic";

  return (
    <div className="mt-6 rounded-[10px] border-2 border-ink bg-cream px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold">
          {failed
            ? "stopped here"
            : done >= stages.length
              ? "every step sent"
              : `stage ${done + 1} of ${stages.length}`}
        </p>
        <p className="mono text-xs font-bold">{percent}%</p>
      </div>

      <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">
        {atomic
          ? "this wallet batches: one signature, and every step lands in the same transaction."
          : "this wallet cannot batch, so it asks once per step. keep this tab open."}
      </p>

      <div
        className="mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-surface"
        role="progressbar"
        aria-label="setup progress"
        aria-valuemin={0}
        aria-valuemax={stages.length}
        aria-valuenow={done}
      >
        <div
          className={`h-full transition-[width] duration-500 ${failed ? "bg-coral" : "bg-teal"} ${
            percent > 0 && percent < 100 ? "border-r-2 border-ink" : ""
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <StageList stages={stages} current={done} failed={failed} className="mt-4" />
    </div>
  );
}

/**
 * What this run does, in the order it does it.
 *
 * An atomic batch gets four stages rather than one per step, because that is what it really is:
 * the steps land in the same transaction and tick together. The mode is read from the run in
 * flight, since a wallet that claimed it could batch can still fall back mid-run.
 */
function runStages(run: Run, batch: BatchState): { label: string; detail: string }[] {
  const selfie = run.selfie
    ? [
        {
          label: "selfie check",
          detail: "prove in World App that you are the one opening this estate",
        },
      ]
    : [];

  if ((batch.mode ?? run.mode) === "atomic") {
    return [
      ...selfie,
      {
        label: "checking every call",
        detail: `all ${run.titles.length} steps simulated in order against sepolia`,
      },
      { label: "one signature", detail: "your wallet shows every step in a single prompt" },
      { label: "confirming on sepolia", detail: "all of it lands in one transaction, or none does" },
    ];
  }

  return [
    ...selfie,
    ...run.titles.map((title, index) => ({
      label: title,
      detail:
        batch.current === index && batch.phase !== "idle"
          ? (pendingLabel(batch.reached) ?? "sending…")
          : "one signature, then a receipt",
    })),
  ];
}

/** How many stages are behind us. */
function stagesDone(run: Run, batch: BatchState): number {
  const offset = run.selfie ? 1 : 0;
  // Idle covers the Selfie Check, and the moment between the click and the first prompt.
  if (batch.phase === "idle") return 0;
  if ((batch.mode ?? run.mode) === "sequential") return offset + batch.current;
  if (batch.phase === "success") return offset + 3;
  return offset + (batch.reached === "confirming" ? 2 : batch.reached === "awaiting-signature" ? 1 : 0);
}

/** What the button says mid-run: which step, and what it is waiting for. */
function busyLabel(run: Run | undefined, batch: BatchState): string {
  const label = pendingLabel(batch.phase) ?? "sending…";
  if (run === undefined || (batch.mode ?? run.mode) === "atomic") return label;
  return `step ${batch.current + 1} of ${run.titles.length}: ${label}`;
}

/** Whether an attestation can still be spent: same estate, same wallet, and time left to send it. */
function stillUsable(signed: SignedAttestation, estateId: bigint, subject: Address): boolean {
  const { attestation } = signed;
  return (
    attestation.estateId === estateId.toString() &&
    isAddressEqual(attestation.subject, subject) &&
    Number(attestation.expiry) - nowSeconds() > ATTESTATION_MARGIN_SECONDS
  );
}

function Frame({
  heading,
  footer,
  children,
}: {
  heading: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="card mt-8 p-6 sm:p-8">
        {heading}
        <div className="mt-7">{children}</div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">{footer}</div>
    </>
  );
}
