"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/content/navigation";
import { estateHref } from "@/lib/estate";
import { Logo } from "./logo";

/** The grantor screens, which share `?estate=` so a picked estate survives moving between them. */
const ESTATE_SCOPED: ReadonlySet<string> = new Set(["/dashboard", "/heirs"]);

export function SiteNav({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = variant === "app";
  const links = app ? APP_LINKS : MARKETING_LINKS;
  // Only carried from a grantor screen: the claim page's `?estate=` names an estate the wallet is
  // an heir of, which the grantor screens would report as not found.
  const estate = ESTATE_SCOPED.has(pathname) ? searchParams.get("estate") : null;

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
                href={estate && ESTATE_SCOPED.has(link.href) ? estateHref(link.href, estate) : link.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {app ? <ConnectWallet /> : <MarketingActions />}
      </nav>
    </div>
  );
}

function MarketingActions() {
  return (
    <div className="flex items-center gap-2">
      <ConnectCta href="/claim" className="btn btn-ghost btn-sm hidden sm:inline-flex">
        i am an heir
      </ConnectCta>
      <ConnectCta href="/setup" className="btn btn-sm">
        open an estate
      </ConnectCta>
    </div>
  );
}
