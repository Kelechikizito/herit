import {
  createPublicClient,
  http,
  isAddressEqual,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";

import { contracts } from "@/lib/contracts/contracts";
import { sepolia } from "@/lib/wagmi/chains";

/**
 * Read-only pre-checks against Sepolia, run by the verify route before it signs.
 *
 * Each one mirrors a revert the transaction would hit, so a doomed attestation is refused here —
 * visibly, and before the user pays gas — instead of one wallet prompt later. They only read: an
 * attestation that never lands (prompt dismissed, estate not unlocked yet, expired) leaves nothing
 * behind, and the retry passes.
 *
 * The chain is the ledger. `LivenessAttestor` enforces every rule here whether or not this runs;
 * see documents/checkpoint-10-guide.md §9.
 */

/** `IHeritRegistry.Status { Active, Grace, Unlocked }`. */
const STATUS_UNLOCKED = 2;

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

export type PreflightResult = { ok: true } | { ok: false; reason: string };

type CheckInInput = { estateId: bigint; subject: Address; commitment: Hex };
type ClaimInput = CheckInInput & { heirLabelhash: bigint };
/** The label as well as its hash: `isAvailable` asks in labels, everything else in ids. */
type SetupCheckInInput = CheckInInput & { label: string };

const pass: PreflightResult = { ok: true };
const refuse = (reason: string): PreflightResult => ({ ok: false, reason });

export async function preflightCheckIn({ estateId, subject, commitment }: CheckInInput): Promise<PreflightResult> {
  const reads = await readOrSkip(() =>
    client.multicall({
      allowFailure: false,
      contracts: [
        // Registry A's `getOwner` reads zero for an unopened or expired id, so no estate is no owner.
        { ...contracts.grantorRegistry, functionName: "getOwner", args: [estateId] },
        { ...contracts.livenessAttestor, functionName: "commitmentOf", args: [estateId] },
        { ...contracts.heritRegistry, functionName: "estateOf", args: [estateId] },
        { ...contracts.heritRegistry, functionName: "statusOf", args: [estateId] },
      ],
    }),
  );
  if (reads === null) return pass;
  const [owner, bound, estate, status] = reads;

  // `LivenessAttestor__NotTheGrantor`
  if (!isAddressEqual(owner, subject)) {
    return refuse("the connected wallet is not this estate's grantor");
  }
  // `LivenessAttestor__WrongHuman` — the thief with the key, failing the face.
  if (bound !== zeroHash && !sameHash(bound, commitment)) {
    return refuse("this estate is bound to a different person");
  }
  // `HeritRegistry__NotConfigured`. `BigInt(0)`, not `0n`: tsconfig targets ES2017.
  if (estate.checkInInterval === BigInt(0)) {
    return refuse("this estate's check-in timers are not configured yet");
  }
  // `HeritRegistry__EstateUnlocked`. The pending status, so a lapsed estate nobody poked counts.
  if (status === STATUS_UNLOCKED) {
    return refuse("this estate has unlocked, and a check-in can no longer reverse it");
  }
  return pass;
}

/**
 * The first check-in, sent in the same run that opens the estate.
 *
 * `preflightCheckIn` leads with two refusals — no owner, no timers — that every brand new estate
 * would trip, because `openEstate` and `configure` have not landed yet. They are not skipped so
 * much as moved: `LivenessAttestor` reads the owner when the call executes, by which point the
 * calls ahead of it in the batch have set one. What is checked here instead is that the label can
 * still be opened at all, so a doomed run is refused before the user pays gas.
 */
export async function preflightSetupCheckIn({
  estateId,
  label,
  subject,
  commitment,
}: SetupCheckInInput): Promise<PreflightResult> {
  const reads = await readOrSkip(() =>
    client.multicall({
      allowFailure: false,
      contracts: [
        { ...contracts.grantorRegistry, functionName: "getOwner", args: [estateId] },
        { ...contracts.accessControlGate, functionName: "estateRegistryOf", args: [estateId] },
        { ...contracts.heritRegistry, functionName: "isAvailable", args: [label] },
        { ...contracts.livenessAttestor, functionName: "commitmentOf", args: [estateId] },
        { ...contracts.heritRegistry, functionName: "statusOf", args: [estateId] },
      ],
    }),
  );
  if (reads === null) return pass;
  const [owner, registry, available, bound, status] = reads;

  // Nothing owns the name yet, which is the ordinary case: the batch is about to open it.
  if (isAddressEqual(owner, zeroAddress)) {
    // `AccessControlGate__EstateAlreadyOpen` — opened once, and the name has since lapsed. The gate
    // refuses to deploy a second registry for it, so this estate cannot be reopened.
    if (!isAddressEqual(registry, zeroAddress)) {
      return refuse("an estate was opened under this name before, and its name has since lapsed");
    }
    // `AccessControlGate__LabelNotAvailable`
    if (!available) return refuse("this name is reserved or already taken");
    return pass;
  }

  // Setup resuming on an estate that is already open.
  // `LivenessAttestor__NotTheGrantor`
  if (!isAddressEqual(owner, subject)) {
    return refuse("someone else already holds this name");
  }
  // `LivenessAttestor__WrongHuman` — the thief with the key, failing the face.
  if (bound !== zeroHash && !sameHash(bound, commitment)) {
    return refuse("this estate is bound to a different person");
  }
  // `HeritRegistry__EstateUnlocked`
  if (status === STATUS_UNLOCKED) {
    return refuse("this estate has unlocked, and a check-in can no longer reverse it");
  }
  return pass;
}

export async function preflightClaim({
  estateId,
  subject,
  commitment,
  heirLabelhash,
}: ClaimInput): Promise<PreflightResult> {
  const reads = await readOrSkip(() =>
    client.multicall({
      allowFailure: false,
      contracts: [
        { ...contracts.heritRegistry, functionName: "statusOf", args: [estateId] },
        { ...contracts.heritRegistry, functionName: "heirAddressOf", args: [estateId, heirLabelhash] },
        { ...contracts.livenessAttestor, functionName: "claimCommitmentUsed", args: [estateId, commitment] },
        { ...contracts.livenessAttestor, functionName: "commitmentOf", args: [estateId] },
      ],
    }),
  );
  if (reads === null) return pass;
  const [status, heirAddress, used, bound] = reads;

  // `ClaimManager__EstateNotUnlocked`. `statusOf` is the pending status and `claim` pokes first,
  // so a lapsed estate nobody has poked already passes.
  if (status !== STATUS_UNLOCKED) {
    return refuse("this estate has not unlocked yet");
  }
  // `ClaimManager__NotEntitled`. Not `gate.canClaim`: its ENS role is granted by the poke inside
  // the claim transaction, so it reads false until then. Also covers an unknown heir, whose
  // address reads zero.
  if (!isAddressEqual(heirAddress, subject)) {
    return refuse("the connected wallet is not the heir registered under this name");
  }
  // `LivenessAttestor__CommitmentUsed`
  if (used) {
    return refuse("this human has already claimed from this estate");
  }
  // `LivenessAttestor__WrongHuman` — the grantor claiming from their own estate.
  if (sameHash(bound, commitment)) {
    return refuse("the grantor cannot claim from their own estate");
  }
  return pass;
}

function sameHash(a: Hex, b: Hex): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Fails open: when the RPC itself is unreachable the checks are skipped rather than blocking a
 * legitimate user. The contract still refuses a bad transaction; only the early rejection is lost.
 */
async function readOrSkip<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    // Name only: viem's messages quote the RPC URL, which carries the provider key.
    console.error(`[preflight] chain read failed, signing without pre-checks: ${error instanceof Error ? error.name : "unknown"}`);
    return null;
  }
}
