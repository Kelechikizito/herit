import { type Address, erc20Abi } from "viem";

import { herit, tokens } from "@/lib/contracts/addresses";
import { type ContractCall, contractCall } from "@/lib/contracts/call";
import { contracts } from "@/lib/contracts/contracts";
import { type SignedAttestation, toAttestationArgs } from "@/lib/selfie-check";
import { DAY, bpsToPercent, formatDuration, fullName, nowSeconds, shortAddress } from "./format";
import { DEPOSIT_ASSETS, type SetupDraft } from "./setup";
import type { SetupProgress } from "./use-setup";

/**
 * Setup as a list of calls.
 *
 * `openEstate` → `configure` → `registerHeir` per heir → `approve` → deposit → `checkIn`. That is
 * the only order the contracts accept: `configure` and `registerHeir` need the name registered,
 * `checkIn` needs the timers set, and the vault pulls an ERC20 with `transferFrom`.
 *
 * Separate from the screen that sends them, because the same list is now two things: what the
 * checklist ticks off, and what one batched signature carries.
 */

/**
 * How long the estate name is registered for. `registerHeir` caps every heir subname at this, and
 * a lapsed name is publicly squattable, so it is set long.
 */
export const ESTATE_TERM_SECONDS = 365 * DAY;

export type SetupStep = {
  key: string;
  title: string;
  detail: string;
  /** Read back from the chain, never set because something was sent. */
  done: boolean;
  /** Undefined for the check-in alone, whose call needs an attestation that does not exist yet. */
  call: ContractCall | undefined;
};

/**
 * The expiry the estate name is registered until, and the cap on every heir subname beneath it.
 *
 * One value for both, because `openEstate` and `registerHeir` can now travel in the same
 * transaction: until that transaction lands the chain reads the estate's expiry as zero, and an
 * heir registered against zero would be born expired. Reads the clock, so call it when sending
 * rather than while rendering.
 */
export function estateExpiryFor(progress: SetupProgress): bigint {
  return progress.opened ? progress.estateExpiry : BigInt(nowSeconds() + ESTATE_TERM_SECONDS);
}

/** Every step this estate needs, in order, with the ones the chain has already seen marked done. */
export function planSetup(
  draft: SetupDraft,
  progress: SetupProgress,
  grantor: Address,
  estateExpiry: bigint,
): SetupStep[] {
  const asset = DEPOSIT_ASSETS[draft.deposit.asset];
  const erc20 = draft.deposit.asset !== "eth";
  const amount = progress.depositAmount ?? BigInt(0);
  const depositing = amount > BigInt(0);
  const estateId = progress.estateId;

  const approve: SetupStep[] =
    depositing && erc20
      ? [
          {
            key: "approve",
            title: `approve ${asset.name}`,
            detail: "lets the vault pull the deposit with transferFrom",
            done: progress.approved,
            call: contractCall({
              address: tokens.mockUsdc,
              abi: erc20Abi,
              functionName: "approve",
              args: [herit.heritVault, amount],
            }),
          },
        ]
      : [];

  const deposit: SetupStep[] = depositing
    ? [
        {
          key: "deposit",
          title: `deposit ${draft.deposit.amount.trim()} ${asset.name}`,
          detail: "escrowed in HeritVault until the estate unlocks",
          done: progress.funded,
          call: erc20
            ? contractCall({
                ...contracts.heritVault,
                functionName: "depositERC20",
                args: [estateId, asset.token, amount],
              })
            : contractCall({
                ...contracts.heritVault,
                functionName: "depositETH",
                args: [estateId],
                value: amount,
              }),
        },
      ]
    : [];

  return [
    {
      key: "open",
      title: `open ${fullName(draft)}`,
      detail: "registers the name and deploys its estate registry",
      done: progress.opened,
      call: contractCall({
        ...contracts.accessControlGate,
        functionName: "openEstate",
        args: [draft.label, grantor, estateExpiry],
      }),
    },
    {
      key: "configure",
      title: "set the timers",
      detail: `check in every ${formatDuration(draft.intervalSeconds)}, then ${formatDuration(draft.graceSeconds)} of grace`,
      done: progress.configured,
      call: contractCall({
        ...contracts.heritRegistry,
        functionName: "configure",
        args: [estateId, BigInt(draft.intervalSeconds), BigInt(draft.graceSeconds)],
      }),
    },
    ...draft.heirs.map(
      (heir, i): SetupStep => ({
        key: `heir:${heir.label}`,
        title: `name ${fullName(draft, heir.label)}`,
        detail: `${bpsToPercent(heir.shareBps)} to ${shortAddress(heir.address)}`,
        done: progress.heirsRegistered[i] ?? false,
        call: contractCall({
          ...contracts.accessControlGate,
          functionName: "registerHeir",
          // The estate's own expiry: `registerHeir` refuses anything later.
          args: [estateId, heir.label, heir.address, heir.relationship, heir.shareBps, estateExpiry],
        }),
      }),
    ),
    ...approve,
    ...deposit,
    {
      key: "checkin",
      title: "selfie check to start the clock",
      detail: "LivenessAttestor.checkIn records your first proof of life",
      done: progress.checkedIn,
      call: undefined,
    },
  ];
}

/**
 * The check-in, once a Selfie Check has produced an attestation.
 *
 * Sent last, after `configure`: `HeritRegistry.checkIn` refuses an estate with no timers. In a
 * batch that is still true — the calls execute in order inside the one transaction.
 */
export function checkInCall(signed: SignedAttestation): ContractCall {
  return contractCall({
    ...contracts.livenessAttestor,
    functionName: "checkIn",
    args: [toAttestationArgs(signed), signed.signature],
  });
}
