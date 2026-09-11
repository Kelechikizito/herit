import { decodeErrorResult, type Abi, type ContractFunctionRevertedError, type Hex } from "viem";

import { accessControlGateAbi } from "@/lib/contracts/abis/accessControlGate.abi";
import { claimManagerAbi } from "@/lib/contracts/abis/claimManager.abi";
import { heritRegistryAbi } from "@/lib/contracts/abis/heritRegistry.abi";
import { heritVaultAbi } from "@/lib/contracts/abis/heritVault.abi";
import { livenessAttestorAbi } from "@/lib/contracts/abis/livenessAttestor.abi";

//converts a failed call error message into UX-friendly message.

type ErrorNameOf<TAbi extends readonly { type: string }[]> = Extract<
  TAbi[number],
  { type: "error"; name: string }
>["name"];

type ContractErrorName =
  | ErrorNameOf<typeof accessControlGateAbi>
  | ErrorNameOf<typeof heritRegistryAbi>
  | ErrorNameOf<typeof heritVaultAbi>
  | ErrorNameOf<typeof claimManagerAbi>
  | ErrorNameOf<typeof livenessAttestorAbi>;

type HeritErrorName = Extract<ContractErrorName, `${string}__${string}`>;

const HERIT_ERRORS_ABI: Abi = [
  ...accessControlGateAbi,
  ...heritRegistryAbi,
  ...heritVaultAbi,
  ...claimManagerAbi,
  ...livenessAttestorAbi,
].filter((item) => item.type === "error");


const APP_BUG = "the app called the contract the wrong way: a bug in Herit, not something you did";
const RETRY_SELFIE = "run the selfie check again for a fresh one";

const MESSAGES = {
  // HeritRegistry
  HeritRegistry__ZeroAddress: "an address is missing — enter a wallet address",
  HeritRegistry__NotGrantor: "only the wallet that owns this estate's name can do this",
  HeritRegistry__NotGate: APP_BUG,
  HeritRegistry__NotAttestor: APP_BUG,
  HeritRegistry__EstateNotFound: "no estate exists under this name",
  HeritRegistry__NotConfigured: "this estate's check-in timers are not set yet — configure them first",
  HeritRegistry__EstateUnlocked: "this estate has unlocked, so it can no longer be changed",
  HeritRegistry__InvalidTimers:
    "the timers are outside the allowed range, or the estate has left active and can no longer be retuned",
  HeritRegistry__TooManyHeirs: "this estate already has the maximum number of heirs",
  HeritRegistry__HeirNotFound: "no heir is registered under that name in this estate",
  HeritRegistry__ShareOverflow: "that share takes the total above 100% — lower it or another heir's",
  HeritRegistry__NotActive: "this only works while the estate is active — check in first",
  HeritRegistry__TooManyTokens: "this estate already overrides shares for the maximum number of tokens",

  // AccessControlGate
  AccessControlGate__ZeroAddress: "enter a wallet address",
  AccessControlGate__NotHeritRegistry: APP_BUG,
  AccessControlGate__NotGrantor: "only the wallet that owns this estate's name can add heirs",
  AccessControlGate__EstateNotFound: "no estate has been opened under this name",
  AccessControlGate__LabelNotAvailable: "that name is already taken",
  AccessControlGate__EstateAlreadyOpen: "an estate is already open under this name",
  AccessControlGate__ExpiryExceedsEstate: "an heir's name cannot outlive the estate's name",
  AccessControlGate__EstateExpired: "this estate's name has expired. renew it first",
  AccessControlGate__ExpiryTooFar: "that renewal reaches further ahead than allowed. pick an earlier date",

  // HeritVault
  HeritVault__ZeroAddress: "an address is missing. enter where the funds should go",
  HeritVault__NotGrantor: "only the grantor's wallet can deposit into or withdraw from this estate",
  HeritVault__NotHeritRegistry: APP_BUG,
  HeritVault__NotClaimManager: APP_BUG,
  HeritVault__ZeroAmount: "enter an amount above zero",
  HeritVault__InsufficientBalance: "the vault holds less than that. lower the amount",
  HeritVault__ShareTooLarge: "a share above 100% cannot be paid out",
  HeritVault__EthTransferFailed: "the ETH transfer failed. the recipient may not accept ETH",
  HeritVault__EstateNotFound: "no estate exists under this name, or its name has expired",
  HeritVault__EstateUnlocked: "this estate has unlocked. its assets now belong to the heirs, so deposits and withdrawals are closed",
  HeritVault__SnapshotNotTaken: APP_BUG,
  HeritVault__TooManyTokens: "this vault already holds the maximum number of different tokens",
  HeritVault__NotAnErc20: "deposit ETH through the ETH option, not as a token",

  // ClaimManager
  ClaimManager__ZeroAddress: APP_BUG,
  ClaimManager__NotAttestor: APP_BUG,
  ClaimManager__EstateNotUnlocked: "this estate has not unlocked yet. claims open once the grace period ends",
  ClaimManager__HeirNotFound: "no heir is registered under that name in this estate",
  ClaimManager__NotEntitled: "the connected wallet is not the heir registered under this name",
  ClaimManager__InvalidShare: "this heir's share is set above 100%, so it cannot be paid",
  ClaimManager__NothingToClaim: "there is nothing left for this heir to claim",

  // LivenessAttestor
  LivenessAttestor__ZeroAddress: APP_BUG,
  LivenessAttestor__InvalidSigner: "the attestation was not signed by Herit's attestor — the server's key is misconfigured",
  LivenessAttestor__InvalidSignature: "the attestation was not signed by Herit's attestor — the server's key is misconfigured",
  LivenessAttestor__AttestationExpired: `the selfie check attestation expired before it reached the chain — ${RETRY_SELFIE}`,
  LivenessAttestor__NonceUsed: `this attestation has already been used — ${RETRY_SELFIE}`,
  LivenessAttestor__WrongAction: `this attestation was issued for a different action — ${RETRY_SELFIE}`,
  LivenessAttestor__SubjectMismatch: "the attestation was issued to a different wallet — reconnect the wallet you verified with",
  LivenessAttestor__NotTheGrantor: "the connected wallet is not this estate's grantor",
  LivenessAttestor__WrongHuman:
    "the wrong person passed this selfie check: either not the estate's grantor, or the grantor claiming from their own estate",
  LivenessAttestor__CommitmentUsed: "this person has already claimed from this estate",
  LivenessAttestor__ZeroCommitment: `the attestation is missing its commitment — ${RETRY_SELFIE}`,

  // Inherited from libraries. Optional — any not listed fall back to the revert's own message.
  ECDSAInvalidSignature: `the attestation's signature is malformed — ${RETRY_SELFIE}`,
  ECDSAInvalidSignatureLength: `the attestation's signature is malformed — ${RETRY_SELFIE}`,
  ECDSAInvalidSignatureS: `the attestation's signature is malformed — ${RETRY_SELFIE}`,
  LabelIsEmpty: "enter a name",
  LabelIsTooLong: "that name is too long",
  SafeERC20FailedOperation: "the token transfer failed — check the balance and the approval",
} satisfies Record<HeritErrorName, string> & Partial<Record<ContractErrorName, string>>;

const MESSAGE_BY_NAME: ReadonlyMap<string, string> = new Map(Object.entries(MESSAGES));

/** A sentence for any error a read, simulation, write or wallet prompt can throw. */
export function describeError(error: unknown): string {
  if (isUserRejection(error)) return "you dismissed the wallet prompt, so nothing was sent";

  const revert = findRevert(error);
  if (revert) {
    const name = customErrorName(revert);
    const message = name === undefined ? undefined : MESSAGE_BY_NAME.get(name);
    if (message) return message;
    // `require(…, "reason")` or a panic.
    if (revert.reason) return revert.reason;
    return name ? `the contract refused this call (${name})` : "the contract refused this call";
  }

  return headline(error) ?? "something went wrong";
}

/**
 * The custom error a call reverted with, decoded against all five contracts. `undefined` when the
 * call did not revert, reverted with a plain reason or panic, or with an error none of them declare.
 */
export function revertErrorName(error: unknown): string | undefined {
  const revert = findRevert(error);
  return revert ? customErrorName(revert) : undefined;
}

/** The user closed or declined the wallet prompt. Not a failure worth a red banner. */
export function isUserRejection(error: unknown): boolean {
  for (const cause of causes(error)) {
    const { code, name } = cause as { code?: unknown; name?: unknown };
    // 4001 is EIP-1193's "user rejected", whether or not a library wrapped it.
    if (code === 4001 || name === "UserRejectedRequestError") return true;
  }
  return false;
}

function findRevert(error: unknown): ContractFunctionRevertedError | undefined {
  for (const cause of causes(error)) {
    // By name, not `instanceof`: viem sets it explicitly, so it survives minification, and a second
    // copy of viem (its CJS and ESM builds are already two different classes) cannot hide a revert.
    if ((cause as { name?: unknown }).name === "ContractFunctionRevertedError") {
      return cause as ContractFunctionRevertedError;
    }
  }
  return undefined;
}

function customErrorName(revert: ContractFunctionRevertedError): string | undefined {
  const name = revert.data?.errorName ?? decodeRaw(revert.raw);
  return name === "Error" || name === "Panic" ? undefined : name;
}

function decodeRaw(raw: Hex | undefined): string | undefined {
  if (!raw || raw === "0x") return undefined;
  try {
    return decodeErrorResult({ abi: HERIT_ERRORS_ABI, data: raw }).errorName;
  } catch {
    return undefined;
  }
}

/** Outermost first, following `cause`. viem and wagmi both nest errors this way. */
function* causes(error: unknown): Generator<unknown> {
  let current = error;
  for (let depth = 0; current !== null && current !== undefined && depth < 16; depth++) {
    yield current;
    current = (current as { cause?: unknown }).cause;
  }
}

/** The first line only: viem and wagmi put details below it, and RPC details can quote the URL. */
function headline(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { shortMessage, message } = error as { shortMessage?: unknown; message?: unknown };
  if (typeof shortMessage === "string" && shortMessage) return shortMessage;
  if (typeof message === "string" && message) return message.split("\n")[0];
  return undefined;
}
