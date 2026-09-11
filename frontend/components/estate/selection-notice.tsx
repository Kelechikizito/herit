"use client";

import Link from "next/link";
import { useState } from "react";
import { EntryLinks } from "@/components/estate/entry-switcher";
import { AlertIcon, ClockIcon, TreeIcon, WalletIcon } from "@/components/ui/icons";
import { WalletPicker } from "@/components/wallet/wallet-picker";
import { describeError } from "@/lib/contracts/errors";
import type { EntryLink } from "@/lib/estate";
import type { Resolved } from "@/lib/estate/use-discovery";

type Audience = "grantor" | "heir";

type Copy = { title: string; body: string };

const COPY: Record<
  Audience,
  { disconnected: Copy; loading: Copy; empty: Copy; notFound: (name: string) => Copy }
> = {
  grantor: {
    disconnected: {
      title: "connect to see your estate",
      body: "an estate belongs to the wallet that owns its name, so herit needs to know which wallet is asking.",
    },
    loading: {
      title: "finding your estates",
      body: "reading the estates this wallet opened, and checking it still owns each name.",
    },
    empty: {
      title: "no estate yet",
      body: "this wallet does not own an estate. open one to name your heirs and start the clock.",
    },
    notFound: (name) => ({
      title: "no estate by that name",
      body: `this wallet does not own ${name}.`,
    }),
  },
  heir: {
    disconnected: {
      title: "connect to see your claim",
      body: "a claim is scoped to the wallet that controls the heir subname, so herit needs to know which wallet is asking.",
    },
    loading: {
      title: "finding your claims",
      body: "reading every estate that names this wallet as an heir.",
    },
    empty: {
      title: "nothing to claim",
      body: "no estate names this wallet as an heir. connect the wallet the grantor registered for you.",
    },
    notFound: (name) => ({
      title: "no claim by that name",
      body: `this wallet holds no heir slot matching ${name}.`,
    }),
  },
};

/** Everything a screen shows before it has one estate or heir slot to render. */
export function SelectionNotice<T>({
  resolved,
  audience,
  requested,
  toLink,
}: {
  resolved: Exclude<Resolved<T>, { kind: "selected" }>;
  audience: Audience;
  /** The name the URL asked for, shown when it matches nothing this wallet holds. */
  requested?: string;
  toLink: (entry: T) => EntryLink;
}) {
  const copy = COPY[audience];

  switch (resolved.kind) {
    case "reconnecting":
      return (
        <Notice
          icon={<WalletIcon size={22} />}
          title="checking your wallet"
          body="restoring the last connection."
        />
      );

    case "disconnected":
      return <ConnectNotice copy={copy.disconnected} />;

    case "loading":
      return <Notice icon={<ClockIcon size={22} />} {...copy.loading} />;

    case "error":
      return (
        <Notice
          icon={<AlertIcon size={22} />}
          title="could not read sepolia"
          body={describeError(resolved.error)}
          action={
            <button type="button" className="btn mt-5" onClick={resolved.retry}>
              try again
            </button>
          }
        />
      );

    case "empty":
      return (
        <Notice
          icon={<TreeIcon size={22} />}
          {...copy.empty}
          action={
            audience === "grantor" ? (
              <Link href="/setup" className="btn mt-5">
                open an estate
              </Link>
            ) : undefined
          }
        />
      );

    case "not-found":
      return (
        <Notice
          icon={<AlertIcon size={22} />}
          {...copy.notFound(requested ?? "that name")}
          action={
            <EntryLinks className="mt-5 justify-center" links={resolved.entries.map(toLink)} />
          }
        />
      );
  }
}

function ConnectNotice({ copy }: { copy: Copy }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Notice
        icon={<WalletIcon size={22} />}
        {...copy}
        action={
          <button type="button" className="btn mt-5" onClick={() => setPickerOpen(true)}>
            <WalletIcon size={14} />
            connect wallet
          </button>
        }
      />
      <WalletPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <span className="icon-box mx-auto bg-lavender">{icon}</span>
      <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
