"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletIcon } from "@/components/ui/icons";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/content/navigation";
import { CONNECTED_ADDRESS } from "@/lib/fixtures/estate";
import { shortAddress } from "@/lib/estate";
import { Logo } from "./logo";

/**
 * The floating navbar. White surface, 2px ink border on all sides, hard shadow, sticky at 16px -
 * the shape DESIGN.md describes, shared by the marketing page and the app shell so the two never
 * read as separate products.
 */
export function SiteNav({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const pathname = usePathname();
  const app = variant === "app";
  const links = app ? APP_LINKS : MARKETING_LINKS;

  return (
    <div className="sticky top-4 z-50 px-4 sm:px-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-[10px] border-2 border-ink bg-surface px-4 py-3 shadow-brut sm:px-6">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = app && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {app ? <ConnectedWallet /> : <MarketingActions />}
      </nav>
    </div>
  );
}

function ConnectedWallet() {
  return (
    <span className="tag tag-shadow bg-teal">
      <WalletIcon size={14} />
      <span className="mono">{shortAddress(CONNECTED_ADDRESS)}</span>
    </span>
  );
}

function MarketingActions() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/claim" className="btn btn-ghost btn-sm hidden sm:inline-flex">
        i am an heir
      </Link>
      <Link href="/setup" className="btn btn-sm">
        open an estate
      </Link>
    </div>
  );
}
