"use client";

import { useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { TxStatus } from "@/components/estate/tx-status";
import { FormField } from "@/components/ui/form-field";
import { PlusIcon, VaultIcon } from "@/components/ui/icons";
import { AlertNote } from "@/components/ui/note";
import { CHAIN_ID, herit, tokens } from "@/lib/contracts/addresses";
import { contracts } from "@/lib/contracts/contracts";
import {
  DEPOSIT_ASSETS,
  type DepositAsset,
  type Estate,
  type Vault,
  type VaultToken,
  formatTokenAmount,
  parseDeposit,
} from "@/lib/estate";
import { pendingLabel, useTransaction } from "@/lib/wagmi/use-transaction";
import { useWallet } from "@/lib/wagmi/use-wallet";

type Mode = "deposit" | "withdraw";

const ASSETS = Object.keys(DEPOSIT_ASSETS) as DepositAsset[];

/**
 * Deposit and withdraw, grantor only and only before unlock. Withdraw is the trust story: a will
 * you cannot change is a bad will, and the money stays yours until the clock says otherwise.
 */
export function VaultActions({ estate, vault }: { estate: Estate; vault: Vault }) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (estate.status === "unlocked") {
    return (
      <AlertNote className="mt-5">
        the estate has unlocked, so deposits and withdrawals are closed — what the vault holds now
        belongs to the heirs.
      </AlertNote>
    );
  }

  const withdrawable = vault.tokens.filter((token) => token.balance > BigInt(0));

  if (mode === null) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("deposit")}>
          <PlusIcon size={15} />
          deposit
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMode("withdraw")}
          disabled={withdrawable.length === 0}
          title={withdrawable.length === 0 ? "nothing to withdraw" : undefined}
        >
          <VaultIcon size={15} />
          withdraw
        </button>
      </div>
    );
  }

  const close = () => setMode(null);
  return mode === "deposit" ? (
    <DepositForm estateId={estate.estateId} onClose={close} />
  ) : (
    <WithdrawForm estateId={estate.estateId} tokens={withdrawable} onClose={close} />
  );
}

function DepositForm({ estateId, onClose }: { estateId: bigint; onClose: () => void }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [asset, setAsset] = useState<DepositAsset>("eth");
  const [amount, setAmount] = useState("");

  const erc20 = asset !== "eth";
  const token = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: tokens.mockUsdc, abi: erc20Abi, functionName: "decimals", chainId: CHAIN_ID },
      {
        address: tokens.mockUsdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: address === undefined ? undefined : [address, herit.heritVault],
        chainId: CHAIN_ID,
      },
    ],
    query: { enabled: erc20 && address !== undefined },
  });

  const decimals = erc20 ? token.data?.[0] : 18;
  const value = decimals === undefined ? undefined : parseDeposit(amount, decimals);
  const valid = value !== undefined && value > BigInt(0);
  const needsApproval = erc20 && valid && (token.data === undefined || token.data[1] < value);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;

    if (erc20) {
      if (needsApproval) {
        // Two prompts, two clicks: the allowance is re-read after this lands, and the button
        // turns into the deposit.
        await tx.send({
          address: tokens.mockUsdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [herit.heritVault, value],
        });
        return;
      }
      const sent = await tx.send({
        ...contracts.heritVault,
        functionName: "depositERC20",
        args: [estateId, DEPOSIT_ASSETS[asset].token, value],
      });
      if (sent) setAmount("");
      return;
    }

    const sent = await tx.send({
      ...contracts.heritVault,
      functionName: "depositETH",
      args: [estateId],
      value,
    });
    if (sent) setAmount("");
  }

  return (
    <form className="mt-5 space-y-3 border-t-2 border-ink pt-5" onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        {ASSETS.map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-[8px] border-2 border-ink px-3 py-1.5 text-xs font-bold ${
              asset === key ? "bg-yellow" : "bg-surface"
            }`}
            aria-pressed={asset === key}
            onClick={() => {
              setAsset(key);
              tx.reset();
            }}
          >
            {DEPOSIT_ASSETS[key].name}
          </button>
        ))}
      </div>

      <FormField id="deposit-amount" label={`amount (${DEPOSIT_ASSETS[asset].name})`}>
        <input
          id="deposit-amount"
          className="input mono"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </FormField>

      <FormActions
        label={needsApproval ? `approve ${DEPOSIT_ASSETS[asset].name}` : "deposit"}
        pending={pendingLabel(tx.phase)}
        disabled={!valid || tx.busy || tx.blocked !== undefined}
        onClose={onClose}
        closeDisabled={tx.busy}
      />
      {tx.blocked ? <p className="hint">{tx.blocked}</p> : null}
      <TxStatus tx={tx} />
    </form>
  );
}

function WithdrawForm({
  estateId,
  tokens: held,
  onClose,
}: {
  estateId: bigint;
  tokens: readonly VaultToken[];
  onClose: () => void;
}) {
  const tx = useTransaction();
  const [selected, setSelected] = useState(0);
  const [amount, setAmount] = useState("");

  // The list can shrink under the form when a withdrawal empties a token.
  const token = held[Math.min(selected, held.length - 1)];
  if (token === undefined) {
    return (
      <div className="mt-5 border-t-2 border-ink pt-5">
        <AlertNote>the vault is empty — nothing left to withdraw.</AlertNote>
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={onClose}>
          close
        </button>
      </div>
    );
  }

  const value = parseDeposit(amount, token.decimals);
  const tooMuch = value !== undefined && value > token.balance;
  const valid = value !== undefined && value > BigInt(0) && !tooMuch;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || token === undefined) return;
    const sent = await tx.send({
      ...contracts.heritVault,
      functionName: "withdraw",
      args: [estateId, token.token, value],
    });
    if (sent) setAmount("");
  }

  return (
    <form className="mt-5 space-y-3 border-t-2 border-ink pt-5" onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        {held.map((entry, index) => (
          <button
            key={entry.token}
            type="button"
            className={`rounded-[8px] border-2 border-ink px-3 py-1.5 text-xs font-bold ${
              entry === token ? "bg-yellow" : "bg-surface"
            }`}
            aria-pressed={entry === token}
            onClick={() => {
              setSelected(index);
              setAmount("");
              tx.reset();
            }}
          >
            {entry.symbol}
          </button>
        ))}
      </div>

      <FormField
        id="withdraw-amount"
        label={`amount (${token.symbol})`}
        hint={tooMuch ? "more than the vault holds" : `the vault holds ${formatTokenAmount(token.balance, token)}`}
      >
        <div className="flex gap-2">
          <input
            id="withdraw-amount"
            className="input mono"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAmount(formatUnits(token.balance, token.decimals))}
          >
            max
          </button>
        </div>
      </FormField>

      <FormActions
        label="withdraw to my wallet"
        pending={pendingLabel(tx.phase)}
        disabled={!valid || tx.busy || tx.blocked !== undefined}
        onClose={onClose}
        closeDisabled={tx.busy}
      />
      {tx.blocked ? <p className="hint">{tx.blocked}</p> : null}
      <TxStatus tx={tx} />
    </form>
  );
}

function FormActions({
  label,
  pending,
  disabled,
  onClose,
  closeDisabled,
}: {
  label: string;
  pending: string | undefined;
  disabled: boolean;
  onClose: () => void;
  closeDisabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button type="submit" className="btn btn-sm flex-1" disabled={disabled}>
        {pending ?? label}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={closeDisabled}>
        close
      </button>
    </div>
  );
}
