import { type Address, isAddress, isAddressEqual, parseUnits, zeroAddress } from "viem";
import { NATIVE_TOKEN, tokens } from "@/lib/contracts/addresses";
import { isLabel } from "./ids";
import { GRACE_PRESETS, INTERVAL_PRESETS } from "./presets";
import { BPS_DENOMINATOR } from "./types";

/**
 * The setup wizard's draft, and every check it runs before anything is sent.
 *
 * Pure: no React, no chain. The bounds come in as `SetupLimits`, read off `HeritRegistry` by the
 * caller, so a redeploy with different constants cannot leave a stale copy here.
 */

/** An heir being drafted, before anything is minted. */
export type DraftHeir = {
  label: string;
  relationship: string;
  address: Address;
  shareBps: number;
};

export type DepositAsset = "eth" | "usdc";

export const DEPOSIT_ASSETS: Record<DepositAsset, { token: Address; name: string }> = {
  eth: { token: NATIVE_TOKEN, name: "ETH" },
  usdc: { token: tokens.mockUsdc, name: "MockUSDC" },
};

export type SetupDraft = {
  label: string;
  intervalSeconds: number;
  graceSeconds: number;
  heirs: DraftHeir[];
  deposit: { asset: DepositAsset; amount: string };
  /** Drafting or sending. Stored with the rest, so a reload mid-setup returns to the checklist. */
  running: boolean;
};

export const INITIAL_DRAFT: SetupDraft = {
  label: "",
  intervalSeconds: INTERVAL_PRESETS[2].seconds,
  graceSeconds: GRACE_PRESETS[2].seconds,
  heirs: [],
  deposit: { asset: "eth", amount: "" },
  running: false,
};

export type SetupAction =
  | { type: "label"; label: string }
  | { type: "interval"; seconds: number }
  | { type: "grace"; seconds: number }
  | { type: "add-heir"; heir: DraftHeir }
  | { type: "remove-heir"; label: string }
  | { type: "deposit-asset"; asset: DepositAsset }
  | { type: "deposit-amount"; amount: string }
  | { type: "run"; running: boolean }
  | { type: "clear" };

export function setupReducer(draft: SetupDraft, action: SetupAction): SetupDraft {
  switch (action.type) {
    case "label":
      return { ...draft, label: action.label };
    case "interval":
      return { ...draft, intervalSeconds: action.seconds };
    case "grace":
      return { ...draft, graceSeconds: action.seconds };
    case "add-heir":
      return { ...draft, heirs: [...draft.heirs, action.heir] };
    case "remove-heir":
      return { ...draft, heirs: draft.heirs.filter((heir) => heir.label !== action.label) };
    case "deposit-asset":
      return { ...draft, deposit: { ...draft.deposit, asset: action.asset } };
    case "deposit-amount":
      return { ...draft, deposit: { ...draft.deposit, amount: action.amount } };
    case "run":
      return { ...draft, running: action.running };
    case "clear":
      return INITIAL_DRAFT;
  }
}

/** `HeritRegistry`'s `MIN_*` / `MAX_*` constants, in seconds, and `MAX_HEIRS`. */
export type SetupLimits = {
  minInterval: number;
  maxInterval: number;
  minGrace: number;
  maxGrace: number;
  maxHeirs: number;
};

/*//////////////////////////////////////////////////////////////
                           VALIDATION
//////////////////////////////////////////////////////////////*/

export function labelProblem(label: string): string | undefined {
  if (label === "") return "enter a label";
  if (!isLabel(label)) return "use lowercase letters, digits and hyphens, up to 63 characters";
  return undefined;
}

export function timerProblem(
  intervalSeconds: number,
  graceSeconds: number,
  limits: SetupLimits,
): string | undefined {
  if (intervalSeconds < limits.minInterval || intervalSeconds > limits.maxInterval) {
    return "the check-in interval is outside the range the registry accepts";
  }
  if (graceSeconds < limits.minGrace || graceSeconds > limits.maxGrace) {
    return "the grace period is outside the range the registry accepts";
  }
  return undefined;
}

/**
 * A share typed as a percentage, in basis points. Undefined for anything that is not a positive
 * number with at most two decimals — a basis point is the finest share the contract stores.
 */
export function percentToBps(percent: string): number | undefined {
  const value = Number(percent);
  if (percent.trim() === "" || !Number.isFinite(value) || value <= 0) return undefined;
  const bps = Math.round(value * 100);
  return Math.abs(bps - value * 100) < 1e-6 ? bps : undefined;
}

/** The raw text of an heir form, whichever screen it is on. */
export type HeirInput = {
  label: string;
  address: string;
  relationship: string;
  sharePercent: string;
};

/** What an heir is checked against: the heirs already named, and how much is left to give. */
export type HeirContext = {
  takenLabels: readonly string[];
  allocatedBps: number;
  maxHeirs: number;
};

export type ParsedHeir = { ok: true; heir: DraftHeir } | { ok: false; problem: string };

/** One heir, checked the way `registerHeir` and `recordHeir` would check it. */
export function parseHeir(input: HeirInput, context: HeirContext): ParsedHeir {
  const label = input.label.trim();
  const address = input.address.trim();

  if (context.takenLabels.length >= context.maxHeirs) {
    return { ok: false, problem: `an estate holds at most ${context.maxHeirs} heirs` };
  }
  const badLabel = labelProblem(label);
  if (badLabel) return { ok: false, problem: `subname: ${badLabel}` };
  if (context.takenLabels.includes(label)) {
    return { ok: false, problem: `${label} is already an heir of this estate` };
  }
  // Names are resolved before they reach here, so whatever arrives is expected to be an address.
  if (!isAddress(address) || isAddressEqual(address, zeroAddress)) {
    return {
      ok: false,
      problem: "enter the heir's wallet address, or an ENS name that resolves to one",
    };
  }

  const shareBps = percentToBps(input.sharePercent);
  if (shareBps === undefined) {
    return { ok: false, problem: "enter a share above 0%, to at most two decimals" };
  }
  const left = BPS_DENOMINATOR - context.allocatedBps;
  if (shareBps > left) {
    return { ok: false, problem: `only ${left / 100}% is left to allocate` };
  }

  return {
    ok: true,
    heir: { label, address, relationship: input.relationship.trim(), shareBps },
  };
}

/** The deposit in base units. Zero means no deposit; undefined means the text is not an amount. */
export function parseDeposit(amount: string, decimals: number): bigint | undefined {
  const text = amount.trim();
  if (text === "") return BigInt(0);
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return undefined;
  try {
    return parseUnits(text, decimals);
  } catch {
    return undefined;
  }
}

export function allocatedDraftBps(heirs: readonly DraftHeir[]): number {
  return heirs.reduce((total, heir) => total + heir.shareBps, 0);
}

/*//////////////////////////////////////////////////////////////
                            STORAGE
//////////////////////////////////////////////////////////////*/

/**
 * A stored draft read back, or the initial one. Checked field by field: the string came from
 * `localStorage`, which an older build or a hand edit can leave in any shape.
 */
export function parseStoredDraft(raw: string | null): SetupDraft {
  if (raw === null) return INITIAL_DRAFT;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return INITIAL_DRAFT;
    const draft = value as Partial<SetupDraft>;

    const heirs = Array.isArray(draft.heirs) ? draft.heirs.filter(isDraftHeir) : [];
    const deposit = draft.deposit;
    return {
      label: typeof draft.label === "string" ? draft.label : INITIAL_DRAFT.label,
      intervalSeconds: positive(draft.intervalSeconds) ?? INITIAL_DRAFT.intervalSeconds,
      graceSeconds: positive(draft.graceSeconds) ?? INITIAL_DRAFT.graceSeconds,
      heirs,
      deposit:
        typeof deposit === "object" &&
        deposit !== null &&
        (deposit.asset === "eth" || deposit.asset === "usdc") &&
        typeof deposit.amount === "string"
          ? { asset: deposit.asset, amount: deposit.amount }
          : INITIAL_DRAFT.deposit,
      running: draft.running === true,
    };
  } catch {
    return INITIAL_DRAFT;
  }
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isDraftHeir(value: unknown): value is DraftHeir {
  if (typeof value !== "object" || value === null) return false;
  const heir = value as Record<string, unknown>;
  return (
    isLabel(heir.label) &&
    typeof heir.relationship === "string" &&
    typeof heir.address === "string" &&
    isAddress(heir.address) &&
    typeof heir.shareBps === "number" &&
    Number.isInteger(heir.shareBps) &&
    heir.shareBps > 0 &&
    heir.shareBps <= BPS_DENOMINATOR
  );
}
