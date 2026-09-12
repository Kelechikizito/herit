import { type Address, type Hash, isAddressEqual } from "viem";
import { NATIVE_TOKEN } from "@/lib/contracts/addresses";
import {
  type Heir,
  type LogEntry,
  type LogKind,
  type VaultToken,
  bpsToPercent,
  formatDuration,
  formatTokenAmount,
  fullName,
  shortAddress,
} from "@/lib/estate";
import { explorerTxUrl } from "@/lib/wagmi/use-transaction";
import { querySubgraph } from "./client";

/** The subgraph's `ActivityKind`: one per indexed event, named after it. */
export type ActivityKind =
  | "EstateOpened"
  | "EstateConfigured"
  | "HeirRegistered"
  | "HeirUnlocked"
  | "CheckedIn"
  | "EnteredGrace"
  | "Unlocked"
  | "Deposited"
  | "Withdrawn"
  | "Claimed"
  | "ClaimSettled"
  | "CheckInAttested"
  | "ClaimAttested";

/** One indexed event, decoded. Fields its kind does not carry are null. */
export type ActivityRecord = {
  id: string;
  kind: ActivityKind;
  sequence: bigint;
  timestamp: number;
  txHash: Hash;
  account: Address | null;
  heirLabelhash: bigint | null;
  token: Address | null;
  amount: bigint | null;
  shareBps: number | null;
  count: bigint | null;
  checkInInterval: number | null;
  graceDuration: number | null;
};

export type EstateActivity = {
  /** Newest first. */
  records: ActivityRecord[];
  /** The last block the indexer has processed. Anything after it is not in `records` yet. */
  indexedBlock: number;
  hasIndexingErrors: boolean;
};

const ESTATE_ACTIVITY = `
  query EstateActivity($estate: String!, $first: Int!) {
    activityEvents(
      where: { estate: $estate }
      orderBy: sequence
      orderDirection: desc
      first: $first
    ) {
      id
      kind
      sequence
      timestamp
      txHash
      account
      heirLabelhash
      token
      amount
      shareBps
      count
      checkInInterval
      graceDuration
    }
    _meta {
      block {
        number
      }
      hasIndexingErrors
    }
  }
`;

/** As graph-node serialises it: `BigInt` as a decimal string, `Bytes` as hex, `Int` as a number. */
type RawRecord = {
  id: string;
  kind: ActivityKind;
  sequence: string;
  timestamp: string;
  txHash: Hash;
  account: Address | null;
  heirLabelhash: string | null;
  token: Address | null;
  amount: string | null;
  shareBps: number | null;
  count: string | null;
  checkInInterval: string | null;
  graceDuration: string | null;
};

type RawActivity = {
  activityEvents: RawRecord[];
  _meta: { block: { number: number }; hasIndexingErrors: boolean };
};

const toBigInt = (value: string | null) => (value === null ? null : BigInt(value));
const toNumber = (value: string | null) => (value === null ? null : Number(value));

/** The most recent `first` events against one estate. */
export async function fetchEstateActivity(
  estateId: bigint,
  first: number,
  signal?: AbortSignal,
): Promise<EstateActivity> {
  const data = await querySubgraph<RawActivity>(
    ESTATE_ACTIVITY,
    { estate: estateId.toString(), first },
    signal,
  );

  return {
    records: data.activityEvents.map((raw) => ({
      id: raw.id,
      kind: raw.kind,
      sequence: BigInt(raw.sequence),
      timestamp: Number(raw.timestamp),
      txHash: raw.txHash,
      account: raw.account,
      heirLabelhash: toBigInt(raw.heirLabelhash),
      token: raw.token,
      amount: toBigInt(raw.amount),
      shareBps: raw.shareBps,
      count: toBigInt(raw.count),
      checkInInterval: toNumber(raw.checkInInterval),
      graceDuration: toNumber(raw.graceDuration),
    })),
    indexedBlock: data._meta.block.number,
    hasIndexingErrors: data._meta.hasIndexingErrors,
  };
}

/**
 * What the feed borrows from the chain reads to write names and amounts. Pass empty lists while
 * those load: rows fall back to addresses and raw units rather than wait.
 */
export type ActivityContext = {
  estateLabel: string;
  heirs: readonly Pick<Heir, "label" | "labelhash">[];
  tokens: readonly Pick<VaultToken, "token" | "symbol" | "decimals">[];
};

const LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

const SELFIE_CHECKED = " · selfie check passed";

/**
 * The feed's rows, newest first: one row per thing that happened, not per log. A Selfie Check and
 * the check-in it authorised are one row, a claim's per-token payouts fold into it, and the heirs
 * an unlock grants are listed on the unlock.
 */
export function describeActivity(
  records: readonly ActivityRecord[],
  context: ActivityContext,
): LogEntry[] {
  const recovered = checkInsDuringGrace(records);
  return byTransaction(records).flatMap((group) => describeTransaction(group, context, recovered));
}

/** Records split per transaction. A transaction's logs are contiguous, so neighbours suffice. */
function byTransaction(records: readonly ActivityRecord[]): ActivityRecord[][] {
  const groups: ActivityRecord[][] = [];
  for (const record of records) {
    const current = groups[groups.length - 1];
    if (current !== undefined && current[0].txHash === record.txHash) current.push(record);
    else groups.push([record]);
  }
  return groups;
}

function describeTransaction(
  group: readonly ActivityRecord[],
  context: ActivityContext,
  recovered: ReadonlySet<string>,
): LogEntry[] {
  const { txHash, timestamp } = group[0];
  const entries: LogEntry[] = [];
  const add = (kind: LogKind, text: string) =>
    entries.push({ id: `${txHash}:${entries.length}`, stamp: timestamp, kind, text, href: explorerTxUrl(txHash) });
  const ofKind = (kind: ActivityKind) => group.filter((record) => record.kind === kind);
  const heir = (record: ActivityRecord) => heirName(record, context);

  // Latest effect first, like the feed: a claim that pokes unlocks the estate, then pays.
  for (const settled of ofKind("ClaimSettled")) {
    const paid = ofKind("Claimed")
      .filter((claimed) => claimed.heirLabelhash === settled.heirLabelhash)
      .flatMap((claimed) => payment(claimed, context) ?? []);
    const what = paid.length > 0 ? `claimed ${LIST.format(paid)}` : "claimed, with nothing left to pay";
    const checked = ofKind("ClaimAttested").length > 0 ? SELFIE_CHECKED : "";
    add("claim", `${heir(settled)} ${what}${checked}`);
  }

  const unlocked = ofKind("Unlocked");
  const granted = ofKind("HeirUnlocked").map(heir);
  for (const unlock of unlocked) {
    add(
      "unlock",
      granted.length > 0
        ? `estate unlocked — claim role granted to ${LIST.format(granted)}`
        : `estate unlocked — ${plural(Number(unlock.count ?? 0), "heir")} granted the claim role`,
    );
  }
  if (unlocked.length === 0) {
    for (const name of granted) add("unlock", `${name} granted the claim role`);
  }

  if (ofKind("EnteredGrace").length > 0) {
    add("grace", "check-in window lapsed — estate entered grace");
  }

  for (const checkIn of ofKind("CheckedIn")) {
    const what = recovered.has(checkIn.id)
      ? "grantor checked in during grace — estate back to active"
      : "grantor checked in — proof of life renewed";
    add("checkin", `${what}${ofKind("CheckInAttested").length > 0 ? SELFIE_CHECKED : ""}`);
  }

  for (const withdrawn of ofKind("Withdrawn")) {
    add("withdraw", `withdrew ${payment(withdrawn, context) ?? "funds"} from the vault`);
  }
  for (const deposited of ofKind("Deposited")) {
    add("deposit", `deposited ${payment(deposited, context) ?? "funds"} into the vault`);
  }

  for (const registered of ofKind("HeirRegistered")) {
    add("heir", `${heir(registered)} named heir, ${bpsToPercent(registered.shareBps ?? 0)} default share`);
  }

  for (const configured of ofKind("EstateConfigured")) {
    add(
      "opened",
      `clock set — check in every ${formatDuration(configured.checkInInterval ?? 0)}, ` +
        `${formatDuration(configured.graceDuration ?? 0)} grace`,
    );
  }

  for (const opened of ofKind("EstateOpened")) {
    const by = opened.account === null ? "" : ` by ${shortAddress(opened.account)}`;
    add("opened", `${fullName({ label: context.estateLabel })} opened${by}`);
  }

  return entries;
}

/**
 * Check-ins that landed after their window closed: the grace recovery the dashboard should show.
 * Walked oldest first. A check-in is late if a poke recorded grace since the last one, or if it
 * came after that one's window. With no earlier check-in in the page, nothing is claimed.
 */
function checkInsDuringGrace(records: readonly ActivityRecord[]): Set<string> {
  const late = new Set<string>();
  let lastCheckIn: number | undefined;
  let interval: number | undefined;
  let graceRecorded = false;

  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (record.kind === "EstateConfigured" && record.checkInInterval !== null) {
      interval = record.checkInInterval;
    } else if (record.kind === "EnteredGrace") {
      graceRecorded = true;
    } else if (record.kind === "CheckedIn") {
      const windowPassed =
        lastCheckIn !== undefined && interval !== undefined && record.timestamp > lastCheckIn + interval;
      if (graceRecorded || windowPassed) late.add(record.id);
      lastCheckIn = record.timestamp;
      graceRecorded = false;
    }
  }
  return late;
}

function heirName(record: ActivityRecord, context: ActivityContext): string {
  const known =
    record.heirLabelhash === null
      ? undefined
      : context.heirs.find((heir) => heir.labelhash === record.heirLabelhash);
  if (known !== undefined) return fullName({ label: context.estateLabel }, known.label);
  return record.account === null ? "an heir" : `heir ${shortAddress(record.account)}`;
}

/** An event's token amount, as the vault card would print it. */
function payment(record: ActivityRecord, context: ActivityContext): string | undefined {
  const { token, amount } = record;
  if (token === null || amount === null) return undefined;

  const known = context.tokens.find((listed) => isAddressEqual(listed.token, token));
  if (known !== undefined) return formatTokenAmount(amount, known);
  if (isAddressEqual(token, NATIVE_TOKEN)) return formatTokenAmount(amount, { symbol: "ETH", decimals: 18 });
  // Metadata not read yet: raw units against the address, rather than guessed decimals.
  return formatTokenAmount(amount, { symbol: shortAddress(token), decimals: 0 });
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
