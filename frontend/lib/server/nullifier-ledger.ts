import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The nullifier ledger — a demo store, not a production one.
 *
 * A JSON file under `frontend/.data/`, gitignored. It exists so a replay fails before the user
 * pays gas to be rejected, and so the rejection is visible at the demo table. It is **not** the
 * anti-replay mechanism: `LivenessAttestor` is, and it survives a server restart, a redeploy and
 * this file being deleted.
 *
 * Two rules, mirroring the two the contract enforces. Note that they are different rules —
 * World's usual `UNIQUE (action, nullifier)` is wrong here:
 *
 *   check-in  the estate binds to one human on the first check-in, and that human repeats
 *             forever. A uniqueness constraint would lock the grantor out after one check-in.
 *             What is rejected is a *different* human. Mirrors `s_estateCommitment`.
 *
 *   claim     one human, one claim per estate. Mirrors `s_claimUsed`.
 */

// What a nullifier ledger is

// World ID gives the same human the same nullifier for the same action, every time. World's standard advice is a table with UNIQUE (action, nullifier) — insert on every verification, and let the duplicate fail. That's how you stop one person claiming an airdrop twice.

// That rule is wrong for Herit, and applying it literally would reject every check-in after the first. Check-in is deliberately recurring: alice proves liveness every 30 days with the same action herit:alice, so she produces the same nullifier every time. A blind uniqueness constraint would let her check in once and then lock her out forever.

// So the ledger has to mirror what the contract actually enforces, which is two different rules:

const LEDGER_PATH = join(process.cwd(), ".data", "nullifiers.json");

type Ledger = {
  note: string;
  /** estateId -> the human bound to it by the first check-in. */
  estates: Record<
    string,
    { nullifier: string; firstSeen: number; lastSeen: number; count: number }
  >;
  /** `${estateId}:${nullifier}` -> when that human claimed there. */
  claims: Record<string, { at: number }>;
};

const EMPTY: Ledger = {
  note: "Demo store for the ETHOnline build. The chain is the real ledger — see LivenessAttestor.",
  estates: {},
  claims: {},
};

export type LedgerResult = { ok: true } | { ok: false; reason: string };

/**
 * Records a check-in. Rejects a human who is not the one this estate is bound to.
 *
 * The same human checking in repeatedly is the normal case and always passes.
 */
export function recordCheckIn(
  estateId: string,
  nullifier: string,
): Promise<LedgerResult> {
  return withLedger((ledger) => {
    const bound = ledger.estates[estateId];
    const now = Math.floor(Date.now() / 1000);

    if (bound && bound.nullifier !== nullifier) {
      // The stolen-key case. The contract would reject this too, one transaction later.
      return {
        result: {
          ok: false,
          reason: "this estate is bound to a different person",
        },
      };
    }

    ledger.estates[estateId] = bound
      ? { ...bound, lastSeen: now, count: bound.count + 1 }
      : { nullifier, firstSeen: now, lastSeen: now, count: 1 };

    return { result: { ok: true }, write: true };
  });
}

/** Records a claim. One human may claim once per estate. */
export function recordClaim(
  estateId: string,
  nullifier: string,
): Promise<LedgerResult> {
  return withLedger((ledger) => {
    const key = `${estateId}:${nullifier}`;
    if (ledger.claims[key]) {
      return {
        result: {
          ok: false,
          reason: "this human has already claimed from this estate",
        },
      };
    }
    ledger.claims[key] = { at: Math.floor(Date.now() / 1000) };
    return { result: { ok: true }, write: true };
  });
}

/**
 * Read, apply, write — serialized, so two requests in the same second cannot interleave and
 * lose one another's write.
 *
 * Fails **open**: if the file cannot be read or written, the check is skipped rather than
 * blocking a legitimate user. The contract still refuses the duplicate; the only thing lost is
 * the early rejection. A demo that cannot write to disk should still demo.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLedger(
  apply: (ledger: Ledger) => { result: LedgerResult; write?: boolean },
): Promise<LedgerResult> {
  const run = queue.then(async (): Promise<LedgerResult> => {
    let ledger: Ledger;
    try {
      ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8")) as Ledger;
      ledger.estates ??= {};
      ledger.claims ??= {};
    } catch {
      ledger = structuredClone(EMPTY);
    }

    const { result, write } = apply(ledger);
    if (!write) return result;

    try {
      await mkdir(dirname(LEDGER_PATH), { recursive: true });
      // Write beside it and rename, so a crash mid-write cannot leave a truncated file.
      const temporary = `${LEDGER_PATH}.${process.pid}.tmp`;
      await writeFile(
        temporary,
        `${JSON.stringify(ledger, null, 2)}\n`,
        "utf8",
      );
      await rename(temporary, LEDGER_PATH);
    } catch (cause) {
      console.error(
        `[nullifier-ledger] could not persist: ${cause instanceof Error ? cause.name : "unknown"}`,
      );
    }
    return result;
  });

  queue = run.catch(() => undefined);
  return run;
}
