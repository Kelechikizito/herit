"use client";

import Link from "next/link";
import { useState } from "react";
import { erc20Abi } from "viem";
import { TxStatus } from "@/components/estate/tx-status";
import { SelfieCheckModal } from "@/components/selfie-check/selfie-check-modal";
import { CardHeading } from "@/components/ui/card-heading";
import { AlertIcon, ArrowRightIcon, CheckIcon, SelfieIcon, TreeIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import { AlertNote } from "@/components/ui/note";
import { herit, tokens } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import { describeError } from "@/lib/contracts/errors";
import {
  DAY,
  DEPOSIT_ASSETS,
  type Load,
  type SetupAction,
  type SetupDraft,
  bpsToPercent,
  estateHref,
  formatDuration,
  fullName,
  nowSeconds,
  shortAddress,
} from "@/lib/estate";
import type { SetupProgress } from "@/lib/estate/use-setup";
import { useAttestedAction } from "@/lib/wagmi/use-attested-action";
import { pendingLabel, useTransaction } from "@/lib/wagmi/use-transaction";
import { useWallet } from "@/lib/wagmi/use-wallet";

/**
 * How long the estate name is registered for. `registerHeir` caps every heir subname at this, and
 * a lapsed name is publicly squattable, so it is set long.
 */
const ESTATE_TERM_SECONDS = 365 * DAY;

type Step = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  /** What the button says when this is the next step. */
  action: string;
  run: () => void;
};

/**
 * Setup, sent. One wallet prompt per click, in the only order the contracts accept:
 * `openEstate` → `configure` → `registerHeir` per heir → `approve` → deposit → Selfie Check.
 *
 * Each step's tick comes from `useSetupProgress`, which reads the chain. Nothing is marked done
 * because a transaction was sent — only because Sepolia says so — so a reload lands on the right
 * step, and a step is never offered twice.
 */
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
  const tx = useTransaction();
  const checkIn = useAttestedAction("checkin");
  const [verifying, setVerifying] = useState(false);

  const back = (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => dispatch({ type: "run", running: false })}
      disabled={tx.busy || checkIn.busy}
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
      body="one transaction per step, in order. every tick is read back from sepolia, so you can close this tab and pick up exactly where you left off."
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
  const asset = DEPOSIT_ASSETS[draft.deposit.asset];
  const erc20 = draft.deposit.asset !== "eth";
  const amount = p.depositAmount ?? BigInt(0);
  const depositing = amount > BigInt(0);

  const steps: Step[] = [
    {
      key: "open",
      title: `open ${fullName(draft)}`,
      detail: "registers the name and deploys its estate registry",
      done: p.opened,
      action: "open the estate",
      run: () =>
        tx.send({
          ...contracts.accessControlGate,
          functionName: "openEstate",
          args: [draft.label, grantor, BigInt(nowSeconds() + ESTATE_TERM_SECONDS)],
        }),
    },
    {
      key: "configure",
      title: "set the timers",
      detail: `check in every ${formatDuration(draft.intervalSeconds)}, then ${formatDuration(draft.graceSeconds)} of grace`,
      done: p.configured,
      action: "set the timers",
      run: () =>
        tx.send({
          ...contracts.heritRegistry,
          functionName: "configure",
          args: [p.estateId, BigInt(draft.intervalSeconds), BigInt(draft.graceSeconds)],
        }),
    },
    ...draft.heirs.map(
      (heir, i): Step => ({
        key: `heir:${heir.label}`,
        title: `name ${fullName(draft, heir.label)}`,
        detail: `${bpsToPercent(heir.shareBps)} to ${shortAddress(heir.address)}`,
        done: p.heirsRegistered[i] ?? false,
        action: `register ${heir.label}`,
        run: () =>
          tx.send({
            ...contracts.accessControlGate,
            functionName: "registerHeir",
            // The estate's own expiry: `registerHeir` refuses anything later.
            args: [p.estateId, heir.label, heir.address, heir.relationship, heir.shareBps, p.estateExpiry],
          }),
      }),
    ),
    ...(depositing && erc20
      ? [
          {
            key: "approve",
            title: `approve ${asset.name}`,
            detail: "lets the vault pull the deposit with transferFrom",
            done: p.approved,
            action: `approve ${asset.name}`,
            run: () =>
              tx.send({
                address: tokens.mockUsdc,
                abi: erc20Abi,
                functionName: "approve",
                args: [herit.heritVault, amount],
              }),
          },
        ]
      : []),
    ...(depositing
      ? [
          {
            key: "deposit",
            title: `deposit ${draft.deposit.amount.trim()} ${asset.name}`,
            detail: "escrowed in HeritVault until the estate unlocks",
            done: p.funded,
            action: "fund the vault",
            run: erc20
              ? () =>
                  tx.send({
                    ...contracts.heritVault,
                    functionName: "depositERC20",
                    args: [p.estateId, asset.token, amount],
                  })
              : () =>
                  tx.send({
                    ...contracts.heritVault,
                    functionName: "depositETH",
                    args: [p.estateId],
                    value: amount,
                  }),
          },
        ]
      : []),
    {
      key: "checkin",
      title: "selfie check to start the clock",
      detail: "LivenessAttestor.checkIn records your first proof of life",
      done: p.checkedIn,
      action: "selfie check and start the clock",
      run: () => {
        checkIn.reset();
        setVerifying(true);
      },
    },
  ];

  const next = steps.find((step) => !step.done);
  const blocked = p.opened
    ? p.depositAmount === undefined
      ? "the deposit amount is not a number — go back to the draft and fix it"
      : undefined
    : p.blocked;

  return (
    <Frame heading={heading} footer={back}>
      <ol className="space-y-2.5">
        {steps.map((step, index) => {
          const current = step === next;
          return (
            <li
              key={step.key}
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
        })}
      </ol>

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
            className={next.key === "checkin" ? "btn btn-pill w-full" : "btn w-full"}
            onClick={next.run}
            disabled={
              tx.busy || checkIn.busy || progress.fetching || blocked !== undefined || tx.blocked !== undefined
            }
          >
            {next.key === "checkin" ? <SelfieIcon size={17} /> : null}
            {pendingLabel(tx.phase) ?? (progress.fetching ? "reading sepolia…" : next.action)}
          </button>
          {tx.blocked ? <p className="hint text-center">{tx.blocked}</p> : null}
          <TxStatus tx={tx} className="mt-3" />
        </div>
      )}

      <SelfieCheckModal
        open={verifying}
        purpose={{ kind: "checkin", estateLabel: draft.label }}
        onClose={() => setVerifying(false)}
        onVerified={checkIn.submit}
        submission={checkIn.submission}
        onResubmit={checkIn.submit}
        confirmLabel="done"
      />
    </Frame>
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
