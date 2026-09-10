import {
  encodeAbiParameters,
  isAddress,
  isHex,
  keccak256,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { herit } from "@/lib/contracts/addresses";
import { estateIdOf, heirLabelhashOf, isLabel } from "@/lib/estate/ids";
import { preflightCheckIn, preflightClaim } from "@/lib/server/preflight";
import { actionString, type SelfieCheckPurpose } from "@/lib/selfie-check";
import { sepolia } from "@/lib/wagmi/chains";

/**
 * POST /api/worldid/verify
 *
 * Verifies a Selfie Check proof with World, then signs the EIP-712 attestation that
 * `LivenessAttestor` accepts. Checkpoint 10 §7.
 *
 * The browser sends the transaction, never this route — the attestor key holds no gas and can
 * only assert that a check passed.
 *
 * in:  { purpose, subject, result }
 * out: { attestation, signature }
 */

const VERIFY_BASE = "https://developer.world.org/api/v4/verify";

/** Selfie Check's credential identifier in the proof response. */
const SELFIE_IDENTIFIER = "selfie";
const SELFIE_LEGACY_IDENTIFIER = "face";

/** Well under the contract's 30-minute `MAX_ATTESTATION_LIFETIME`, which rejects a long expiry as hard as a stale one. */
const ATTESTATION_TTL_SECONDS = 5 * 60;

/** Field order must match `ATTESTATION_TYPEHASH` exactly, or the digest differs and recovery fails. */
const ATTESTATION_TYPES = {
  Attestation: [
    { name: "estateId", type: "uint256" },
    { name: "subject", type: "address" },
    { name: "action", type: "bytes32" },
    { name: "heirLabelhash", type: "uint256" },
    { name: "commitment", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

/** The contract's two action constants. Not the World ID action string — see §2 of the guide. */
const ACTION_CHECKIN = keccak256(toBytes("checkin"));
const ACTION_CLAIM = keccak256(toBytes("claim"));

class BadRequestError extends Error {}
class ConfigError extends Error {}
class VerificationError extends Error {}

type VerifyRequest = {
  purpose: SelfieCheckPurpose;
  subject: Hex;
  result: unknown;
};

export async function POST(request: Request) {
  let input: VerifyRequest;
  try {
    input = parseBody(await request.json());
  } catch (error) {
    const message = error instanceof BadRequestError ? error.message : "body must be valid JSON";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const config = readConfig();
    const { purpose, subject, result } = input;
    const action = actionString(purpose);

    // 1. Forward the proof exactly as IDKit returned it. Re-encoding any field is the most
    //    common cause of `invalid_proof`.
    const nullifier = await verifyWithWorld(config.rpId, action, result);

    // 2. The estate id is derived, not taken from the caller — it is the same labelhash the gate
    //    computes, and the label is already validated above.
    const estateId = estateIdOf(purpose.estateLabel);
    // `BigInt(0)`, not `0n`: tsconfig targets ES2017, which has no BigInt literals.
    const heirLabelhash = purpose.kind === "claim" ? heirLabelhashOf(purpose.heirLabel) : BigInt(0);

    // 3. Salt the nullifier into a commitment. This encoding is permanent: `s_estateCommitment`
    //    binds an estate to the first commitment it sees, so changing it makes every returning
    //    grantor look like a different human.
    const commitment = keccak256(
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "bytes32" }],
        [BigInt(nullifier), config.nullifierSalt],
      ),
    );

    // 4. Read the chain before signing, so a transaction that would revert is refused here instead
    //    of costing the user gas. Nothing is recorded: the chain is the ledger, and an attestation
    //    that never lands leaves no trace. See lib/server/preflight.ts.
    const preflight =
      purpose.kind === "checkin"
        ? await preflightCheckIn({ estateId, subject, commitment })
        : await preflightClaim({ estateId, subject, commitment, heirLabelhash });
    if (!preflight.ok) throw new VerificationError(preflight.reason);

    const attestation = {
      estateId,
      subject,
      action: purpose.kind === "checkin" ? ACTION_CHECKIN : ACTION_CLAIM,
      heirLabelhash,
      commitment,
      // Random, never a counter: `s_nonceUsed` is one global mapping with no estate in the key,
      // so two estates sharing a counter would collide.
      nonce: randomUint256(),
      expiry: BigInt(Math.floor(Date.now() / 1000) + ATTESTATION_TTL_SECONDS),
    } as const;

    // 5. Sign it. The domain strings come from `EIP712("Herit", "1")` in the constructor and must
    //    match character for character.
    const account = privateKeyToAccount(config.attestorKey);
    const signature = await account.signTypedData({
      domain: {
        name: "Herit",
        version: "1",
        chainId: sepolia.id,
        // The same constant the client sends the transaction to, never an env key that can drift.
        verifyingContract: herit.livenessAttestor,
      },
      types: ATTESTATION_TYPES,
      primaryType: "Attestation",
      message: attestation,
    });

    // uint256 does not survive JSON, so the three big fields go back as decimal strings.
    return Response.json({
      attestation: {
        estateId: attestation.estateId.toString(),
        subject: attestation.subject,
        action: attestation.action,
        heirLabelhash: attestation.heirLabelhash.toString(),
        commitment: attestation.commitment,
        nonce: attestation.nonce.toString(),
        expiry: attestation.expiry.toString(),
      },
      signature,
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ConfigError) {
      console.error(`[worldid/verify] configuration: ${error.message}`);
      return Response.json({ error: "the server is not configured for World ID" }, { status: 500 });
    }
    // Name only: anything thrown from the signer is assumed able to quote its key.
    console.error(`[worldid/verify] failed: ${error instanceof Error ? error.name : "unknown"}`);
    return Response.json({ error: "could not issue an attestation" }, { status: 500 });
  }
}

/**
 * Sends the proof to World and returns the Selfie Check nullifier.
 *
 * Fails closed: anything that is not clearly a success is a rejection, never a fall-through to
 * signing.
 */
async function verifyWithWorld(rpId: string, action: string, result: unknown): Promise<string> {
  const response = await fetch(`${VERIFY_BASE}/${rpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok || !looksVerified(payload)) {
    // The verifier's own message is safe to pass on — it is about the proof, not our keys.
    const detail = errorDetail(payload) ?? `verifier returned ${response.status}`;
    throw new VerificationError(detail);
  }

  const verified = payload as { action?: string; responses?: unknown[] };

  // The proof must be for the action we asked about, or a proof for another estate would pass.
  if (verified.action !== undefined && verified.action !== action) {
    throw new VerificationError("proof was issued for a different action");
  }

  // Read the Selfie Check credential specifically, never just the first response. `face` is the
  // legacy alias for the same credential — accepted on the way in, never constructed on the way out.
  const selfie = (verified.responses ?? []).find((item): item is { identifier: string; nullifier?: string } => {
    if (typeof item !== "object" || item === null) return false;
    const identifier = (item as { identifier?: unknown }).identifier;
    return identifier === SELFIE_IDENTIFIER || identifier === SELFIE_LEGACY_IDENTIFIER;
  });

  if (typeof selfie?.nullifier !== "string" || selfie.nullifier.length === 0) {
    throw new VerificationError("no selfie check nullifier in the verified proof");
  }
  return selfie.nullifier;
}

/**
 * Whether the verifier's body says the proof passed.
 *
 * Confirm the exact success field against a real response on the first working run and tighten
 * this. Until then it only accepts a body that carries verified responses and no error code.
 */
function looksVerified(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const body = payload as Record<string, unknown>;
  if (typeof body.code === "string") return false;
  if (body.success === true) return true;
  return Array.isArray(body.responses) && body.responses.length > 0;
}

function errorDetail(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.code === "string") return body.code;
  return null;
}

function randomUint256(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt(`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`);
}

function readConfig() {
  const rpId = required("WLD_RP_ID", process.env.WLD_RP_ID);
  const nullifierSalt = required("NULLIFIER_SALT", process.env.NULLIFIER_SALT);
  const attestorKey = required("ATTESTOR_PRIVATE_KEY", process.env.ATTESTOR_PRIVATE_KEY);

  // Shapes checked here so a malformed value is our own error, not an exception from viem that
  // might quote the key back.
  if (!isHex(nullifierSalt) || nullifierSalt.length !== 66) {
    throw new ConfigError("NULLIFIER_SALT must be 32 hex bytes, 0x-prefixed");
  }
  if (!isHex(attestorKey) || attestorKey.length !== 66) {
    throw new ConfigError("ATTESTOR_PRIVATE_KEY must be 32 hex bytes, 0x-prefixed");
  }

  return {
    rpId,
    nullifierSalt: nullifierSalt as Hex,
    attestorKey: attestorKey as Hex,
  };
}

function required(key: string, value: string | undefined): string {
  if (!value) throw new ConfigError(`${key} is unset`);
  return value;
}

/**
 * Validates the request body.
 *
 * `subject` must be the wallet that will send the transaction: `LivenessAttestor._verify`
 * requires `a.subject == msg.sender`, so a wrong address here reverts at the last step.
 */
function parseBody(body: unknown): VerifyRequest {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("body must be a JSON object");
  }
  const { purpose, subject, result } = body as Record<string, unknown>;

  if (typeof subject !== "string" || !isAddress(subject)) {
    throw new BadRequestError("subject must be the address that will send the transaction");
  }
  if (result === undefined || result === null) {
    throw new BadRequestError("result is required");
  }
  return { purpose: parsePurpose(purpose), subject, result };
}

function parsePurpose(purpose: unknown): SelfieCheckPurpose {
  if (typeof purpose !== "object" || purpose === null) {
    throw new BadRequestError("purpose is required");
  }
  const { kind, estateLabel, heirLabel } = purpose as Record<string, unknown>;

  if (!isLabel(estateLabel)) {
    throw new BadRequestError("estateLabel must be a lowercase ENS label");
  }
  if (kind === "checkin") return { kind, estateLabel };
  if (kind === "claim") {
    if (!isLabel(heirLabel)) {
      throw new BadRequestError("heirLabel must be a lowercase ENS label");
    }
    return { kind, estateLabel, heirLabel };
  }
  throw new BadRequestError("kind must be 'checkin' or 'claim'");
}
