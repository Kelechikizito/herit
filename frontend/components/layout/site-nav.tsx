"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/content/navigation";
import { Logo } from "./logo";


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
