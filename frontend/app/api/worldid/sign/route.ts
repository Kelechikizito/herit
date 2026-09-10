import { signRequest } from "@worldcoin/idkit/signing";
import type { RpContext } from "@worldcoin/idkit";

import { isLabel } from "@/lib/estate/ids";
import {
  actionString,
  WLD_ENVIRONMENTS,
  type SelfieCheckPurpose,
  type SignResponse,
  type WldEnvironment,
} from "@/lib/selfie-check";

/**
 * POST /api/worldid/sign
 *
 * Signs a World ID verification request as the registered relying party, so the widget can raise
 * a Selfie Check. Checkpoint 10 of `documents/build-plan.md`.
 *
 * This is the first of the two backend steps and it runs *before* the user sees a selfie prompt.
 * The second one takes the proof that comes back and signs an EIP-712 attestation with a
 * different key. `RP_SIGNING_KEY` here proves who is asking; `ATTESTOR_PRIVATE_KEY` there
 * asserts what happened. Never mix them up.
 *
 * in:  { purpose: SelfieCheckPurpose }
 * out: { app_id, action, environment, rp_context }
 */

/** The RP signature's lifetime. Long enough to hold a phone, short enough to be worthless later. */
const RP_SIGNATURE_TTL_SECONDS = 120;

/** A bad request from the caller. Its message is safe to return. */
class BadRequestError extends Error {}

/** A missing or malformed environment variable. Its message names the key, never the value. */
class ConfigError extends Error {}

export async function POST(request: Request) {
  let purpose: SelfieCheckPurpose;
  try {
    purpose = parsePurpose(await request.json());
  } catch (error) {
    const message =
      error instanceof BadRequestError
        ? error.message
        : "body must be valid JSON";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    // Read the config inside the handler, so a missing key fails here with a name attached rather
    // than signing with `undefined` and failing much later, much further away.
    //
    // Written out literally rather than through `process.env[key]`: Next only inlines
    // `NEXT_PUBLIC_*` reads it can see at build time, and a dynamic lookup is not one.
    const appId = required(
      "NEXT_PUBLIC_WLD_APP_ID",
      process.env.NEXT_PUBLIC_WLD_APP_ID,
    );
    const environment = required(
      "NEXT_PUBLIC_WLD_ENVIRONMENT",
      process.env.NEXT_PUBLIC_WLD_ENVIRONMENT,
    );
    const rpId = required("WLD_RP_ID", process.env.WLD_RP_ID);
    const signingKeyHex = required(
      "RP_SIGNING_KEY",
      process.env.RP_SIGNING_KEY,
    );

    if (!appId.startsWith("app_")) {
      throw new ConfigError("NEXT_PUBLIC_WLD_APP_ID must start with 'app_'");
    }
    if (!isEnvironment(environment)) {
      throw new ConfigError(
        `NEXT_PUBLIC_WLD_ENVIRONMENT must be one of ${WLD_ENVIRONMENTS.join(", ")}`,
      );
    }
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(signingKeyHex)) {
      // Checked here so a malformed key is a config error we can safely log, rather than an
      // exception out of `signRequest` whose message might quote the key back.
      throw new ConfigError("RP_SIGNING_KEY must be 32 hex bytes");
    }

    // The server derives the action and returns it. `signRequest` hashes the action into the
    // signed message, so the string signed here and the string the widget requests must match to
    // the byte — have the client use this one rather than recomputing it.
    const action = actionString(purpose);
    const signature = signRequest({
      signingKeyHex,
      action,
      ttl: RP_SIGNATURE_TTL_SECONDS,
    });

    // `signRequest` returns an `RpSignature`; the widget wants an `RpContext`. Four of the five
    // fields are spelled differently and `rp_id` is not in the signature at all, so this remap is
    // load-bearing — passing the signature straight through type-checks nowhere and fails at the
    // widget with the values under the wrong keys.
    const rpContext: RpContext = {
      rp_id: rpId,
      nonce: signature.nonce,
      created_at: signature.createdAt,
      expires_at: signature.expiresAt,
      signature: signature.sig,
    };

    const body: SignResponse = {
      app_id: appId as `app_${string}`,
      action,
      environment,
      rp_context: rpContext,
    };

    // Nothing else goes back: not the key, not a fragment of it, not an error quoting it.
    return Response.json(body);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[worldid/sign] configuration: ${error.message}`);
      return Response.json(
        { error: "the server is not configured for World ID" },
        { status: 500 },
      );
    }
    // Only the error's name — anything thrown from inside the signer is assumed to be able to
    // quote its input.
    console.error(
      `[worldid/sign] signing failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return Response.json(
      { error: "could not sign the verification request" },
      { status: 500 },
    );
  }
}

function required(key: string, value: string | undefined): string {
  if (!value) throw new ConfigError(`${key} is unset`);
  return value;
}

function isEnvironment(value: string): value is WldEnvironment {
  return (WLD_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Validates the request body into a `SelfieCheckPurpose`.
 *
 * The estate label ends up in the World ID action, which is the namespace a human's nullifier is
 * scoped to. Junk in means a junk namespace, and a proof nothing on-chain can ever match, so it
 * is checked here rather than trusted.
 */
function parsePurpose(body: unknown): SelfieCheckPurpose {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("body must be a JSON object");
  }

  const { purpose } = body as { purpose?: unknown };
  if (typeof purpose !== "object" || purpose === null) {
    throw new BadRequestError("purpose is required");
  }

  const { kind, estateLabel, heirLabel } = purpose as Record<string, unknown>;
  if (!isLabel(estateLabel)) {
    throw new BadRequestError("estateLabel must be a lowercase ENS label");
  }

  if (kind === "checkin") {
    return { kind, estateLabel };
  }
  if (kind === "claim") {
    if (!isLabel(heirLabel)) {
      throw new BadRequestError("heirLabel must be a lowercase ENS label");
    }
    return { kind, estateLabel, heirLabel };
  }

  throw new BadRequestError("kind must be 'checkin' or 'claim'");
}
