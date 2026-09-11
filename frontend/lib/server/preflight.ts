import { createPublicClient, http, isAddressEqual, zeroHash, type Address, type Hex } from "viem";

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
