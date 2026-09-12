"use client";

import { useState } from "react";
import { HeirAvatar } from "@/components/estate/heir-avatar";
import { ShareChip } from "@/components/estate/role-chip";
import { ShareBar, heirSegments } from "@/components/estate/share-bar";
import { AddressField } from "@/components/ui/address-field";
import { CardHeading } from "@/components/ui/card-heading";
import { FormField } from "@/components/ui/form-field";
import { AlertIcon, HeirIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import {
  type DraftHeir,
  type HeirInput,
  allocatedDraftBps,
  bpsToPercent,
  fullName,
  parseHeir,
  shortAddress,
} from "@/lib/estate";
import {
  isPendingResolution,
  resolvedAddress,
  useResolvedAddress,
} from "@/lib/wagmi/use-resolved-address";

/** Step three: the heir list being drafted, and the form that appends to it. */
export function HeirsStep({
  estateLabel,
  heirs,
  minted,
  maxHeirs,
  onAdd,
  onRemove,
}: {
  estateLabel: string;
  heirs: readonly DraftHeir[];
  /** Labels already registered on-chain. Heirs are append-only, so these cannot be removed. */
  minted: ReadonlySet<string>;
  maxHeirs: number;
  onAdd: (heir: DraftHeir) => void;
  onRemove: (label: string) => void;
}) {
  const estate = { label: estateLabel || "your-name" };

  return (
    <div>
      <CardHeading
        size="lg"
        icon={HeirIcon}
        accent="bg-pink"
        title="name your next-of-kin"
        body="each heir gets a subname inside your estate registry with a relationship record and a share. the claim role is withheld at registration — that withheld bit is the whole inheritance."
      />

      <div className="mt-7">
        <ShareBar segments={heirSegments(heirs)} />

        {heirs.length === 0 ? (
          <p className="mt-4 text-sm text-muted">no heirs drafted yet. add the first one below.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {heirs.map((heir, index) => (
              <li key={heir.label} className="card-flat flex flex-wrap items-center gap-3 px-4 py-3">
                <HeirAvatar index={index} size="md" />
                <div className="min-w-[10rem] flex-1">
                  <p className="mono text-sm font-bold">{fullName(estate, heir.label)}</p>
                  <p className="text-xs text-muted">
                    {heir.relationship || "no relationship"} · {shortAddress(heir.address)}
                  </p>
                </div>
                <ShareChip>{bpsToPercent(heir.shareBps)}</ShareChip>
                {minted.has(heir.label) ? (
                  <span className="tag bg-teal px-2.5 py-0.5 text-[0.7rem]">minted</span>
                ) : (
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-ink bg-surface hover:bg-coral hover:text-white"
                    aria-label={`remove ${heir.label}`}
                    onClick={() => onRemove(heir.label)}
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DraftHeirForm heirs={heirs} maxHeirs={maxHeirs} onAdd={onAdd} />
    </div>
  );
}

const EMPTY_INPUT: HeirInput = { label: "", address: "", relationship: "", sharePercent: "25" };

/** The inline draft form. Dashed border — nothing here is minted until the wizard finishes. */
function DraftHeirForm({
  heirs,
  maxHeirs,
  onAdd,
}: {
  heirs: readonly DraftHeir[];
  maxHeirs: number;
  onAdd: (heir: DraftHeir) => void;
}) {
  const [input, setInput] = useState<HeirInput>(EMPTY_INPUT);
  const [problem, setProblem] = useState<string | undefined>();

  // `input.address` holds whatever was typed — an address, or a name still being resolved.
  const resolution = useResolvedAddress(input.address);
  const waiting = isPendingResolution(resolution);

  const set = (field: keyof HeirInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput((current) => ({ ...current, [field]: event.target.value }));
    setProblem(undefined);
  };

  function add() {
    const parsed = parseHeir({ ...input, address: resolvedAddress(resolution) ?? input.address }, {
      takenLabels: heirs.map((heir) => heir.label),
      allocatedBps: allocatedDraftBps(heirs),
      maxHeirs,
    });
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }
    onAdd(parsed.heir);
    setInput({ ...EMPTY_INPUT, sharePercent: "" });
  }

  return (
    <div className="mt-7 rounded-[10px] border-2 border-dashed border-ink p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="draft-label" label="subname label">
          <input
            id="draft-label"
            className="input"
            placeholder="son"
            autoComplete="off"
            spellCheck={false}
            value={input.label}
            onChange={(event) => {
              setInput((current) => ({ ...current, label: event.target.value.toLowerCase() }));
              setProblem(undefined);
            }}
          />
        </FormField>

        <FormField id="draft-relationship" label="relationship">
          <input
            id="draft-relationship"
            className="input"
            placeholder="son"
            autoComplete="off"
            value={input.relationship}
            onChange={set("relationship")}
          />
        </FormField>

        <AddressField
          id="draft-address"
          label="controlling address"
          className="sm:col-span-2"
          hint="an address, or an ENS name to resolve — an heir already minted elsewhere resolves by name."
          value={input.address}
          onChange={(address) => {
            setInput((current) => ({ ...current, address }));
            setProblem(undefined);
          }}
          resolution={resolution}
        />

        <FormField id="draft-share" label="share %">
          <input
            id="draft-share"
            className="input mono"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={input.sharePercent}
            onChange={set("sharePercent")}
          />
        </FormField>

        <div className="flex items-end">
          <button type="button" className="btn w-full" onClick={add} disabled={waiting}>
            <PlusIcon size={16} />
            {waiting ? "resolving name…" : "add heir"}
          </button>
        </div>
      </div>

      {problem ? (
        <p className="mt-3 flex items-start gap-2 text-xs font-bold text-coral" role="alert">
          <AlertIcon size={15} />
          {problem}
        </p>
      ) : null}
    </div>
  );
}
