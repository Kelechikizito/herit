"use client";

import { useState } from "react";
import { useReadContracts } from "wagmi";
import { TxStatus } from "@/components/estate/tx-status";
import { CardHeading } from "@/components/ui/card-heading";
import { Sparkle } from "@/components/ui/deco";
import { FormField } from "@/components/ui/form-field";
import { AlertIcon, PlusIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import { CHAIN_ID } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import {
  BPS_DENOMINATOR,
  type Estate,
  type Heir,
  type HeirInput,
  allocatedBps,
  parseHeir,
  unallocatedBps,
} from "@/lib/estate";
import { pendingLabel, useTransaction } from "@/lib/wagmi/use-transaction";

const EMPTY_INPUT: HeirInput = { label: "", address: "", relationship: "", sharePercent: "10" };

/** The form that mints one more subname under the estate, with its claim role withheld. */
export function AddHeirForm({ estate, heirs }: { estate: Estate; heirs: readonly Heir[] }) {
  const unallocated = unallocatedBps(heirs);
  const tx = useTransaction();
  const [input, setInput] = useState<HeirInput>(EMPTY_INPUT);
  const [problem, setProblem] = useState<string | undefined>();

  // Registry A's expiry caps every heir subname, and `MAX_HEIRS` is the registry's own cap.
  const bounds = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...contracts.grantorRegistry,
        functionName: "getExpiry",
        args: [estate.estateId],
        chainId: CHAIN_ID,
      },
      { ...contracts.heritRegistry, functionName: "MAX_HEIRS", chainId: CHAIN_ID },
    ],
  });

  const unlocked = estate.status === "unlocked";
  const disabled = unlocked || bounds.data === undefined || tx.busy;

  const set = (field: keyof HeirInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "label" ? event.target.value.toLowerCase() : event.target.value;
    setInput((current) => ({ ...current, [field]: value }));
    setProblem(undefined);
  };

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bounds.data === undefined) return;
    const [expiry, maxHeirs] = bounds.data;

    const parsed = parseHeir(input, {
      takenLabels: heirs.map((heir) => heir.label),
      allocatedBps: allocatedBps(heirs),
      maxHeirs: Number(maxHeirs),
    });
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }

    const { heir } = parsed;
    const sent = await tx.send({
      ...contracts.accessControlGate,
      functionName: "registerHeir",
      args: [estate.estateId, heir.label, heir.address, heir.relationship, heir.shareBps, expiry],
    });
    if (sent) setInput(EMPTY_INPUT);
  }

  return (
    <section className="card relative overflow-hidden p-6 lg:sticky lg:top-24">
      <Sparkle className="right-5 top-5" size={22} fill="#FFE566" rotate={-10} />

      <CardHeading
        icon={PlusIcon}
        accent="bg-lavender"
        title="name an heir"
        body="mints a subname with the claim role withheld"
      />

      {unlocked ? (
        <AlertNote className="mt-4">
          this estate has unlocked, so its heir list is final.
        </AlertNote>
      ) : null}

      <form className="mt-6" onSubmit={register}>
        <fieldset className="space-y-4" disabled={disabled}>
          <FormField
            id="heir-label"
            label="subname label"
            hint={`${input.label || "daughter"}.${estate.label}.herit.eth`}
            hintMono
          >
            <input
              id="heir-label"
              className="input"
              placeholder="daughter"
              autoComplete="off"
              spellCheck={false}
              value={input.label}
              onChange={set("label")}
            />
          </FormField>

          <FormField
            id="heir-address"
            label="controlling address"
            hint="written as the addr(60) record, and given ROLE_HEIR_CLAIM on unlock."
          >
            <input
              id="heir-address"
              className="input mono"
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              value={input.address}
              onChange={set("address")}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="heir-relationship" label="relationship">
              <input
                id="heir-relationship"
                className="input"
                placeholder="daughter"
                autoComplete="off"
                value={input.relationship}
                onChange={set("relationship")}
              />
            </FormField>
            <FormField id="heir-share" label="share %">
              <input
                id="heir-share"
                className="input mono"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={input.sharePercent}
                onChange={set("sharePercent")}
              />
            </FormField>
          </div>

          <div className="rounded-[8px] border-2 border-ink bg-cream px-4 py-3">
            <BudgetRow label="still unallocated" value={`${unallocated} bps`} />
            <BudgetRow label="cap" value={`${BPS_DENOMINATOR} bps`} className="mt-1" />
          </div>

          <button type="submit" className="btn w-full" disabled={disabled || tx.blocked !== undefined}>
            <PlusIcon size={16} />
            {pendingLabel(tx.phase) ?? "register heir"}
          </button>
        </fieldset>

        {problem ? (
          <p className="mt-3 flex items-start gap-2 text-xs font-bold text-coral" role="alert">
            <AlertIcon size={15} />
            {problem}
          </p>
        ) : null}
        {tx.blocked ? <p className="hint">{tx.blocked}</p> : null}
        <TxStatus tx={tx} success="heir registered on sepolia" className="mt-3" />
      </form>
    </section>
  );
}

function BudgetRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between text-xs ${className}`}>
      <span className="font-bold text-muted">{label}</span>
      <span className="mono font-bold">{value}</span>
    </div>
  );
}
