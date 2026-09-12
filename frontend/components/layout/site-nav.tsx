"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { APP_LINKS, MARKETING_LINKS } from "@/lib/content/navigation";
import { estateHref } from "@/lib/estate";
import { Logo } from "./logo";
import { MobileNav, type ResolvedLink } from "./mobile-nav";

/** The grantor screens, which share `?estate=` so a picked estate survives moving between them. */
const ESTATE_SCOPED: ReadonlySet<string> = new Set(["/dashboard", "/heirs"]);

export function SiteNav({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = variant === "app";
  // Only carried from a grantor screen: the claim page's `?estate=` names an estate the wallet is
  // an heir of, which the grantor screens would report as not found.
  const estate = ESTATE_SCOPED.has(pathname) ? searchParams.get("estate") : null;

  const links: readonly ResolvedLink[] = (app ? APP_LINKS : MARKETING_LINKS).map((link) => ({
    href: estate && ESTATE_SCOPED.has(link.href) ? estateHref(link.href, estate) : link.href,
    label: link.label,
    // Hash links never match a pathname, so this only ever lights a real route.
    active: pathname === link.href,
  }));

  return (
    <div className="sticky top-3 z-50 px-3 sm:top-4 sm:px-6">
      {/* Asymmetric by 2px on purpose: whatever sits on the right — the hamburger, the wallet
          pill — carries a 3px offset shadow, so equal padding reads as a tighter gutter on that
          side than the logo gets on this one. */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-[10px] border-2 border-ink bg-surface py-2.5 pl-3 pr-3.5 shadow-brut sm:gap-4 sm:py-3 sm:pl-6 sm:pr-6">
        <Logo />

        {/* The marketing row carries six section links, which only clear the logo and the two
            calls to action from `lg` up; the app row is three links and fits a tablet. Below
            that breakpoint the same links live in the hamburger. */}
        <div className={`hidden items-center gap-1 ${app ? "md:flex" : "lg:flex"}`}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${link.active ? "nav-link-active" : ""}`}
              aria-current={link.active ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {app ? <ConnectWallet /> : <MarketingActions />}

          <MobileNav links={links} className={app ? "md:hidden" : "lg:hidden"}>
            {/* Only below `sm`, where the bar drops this one for room. */}
            {app ? null : (
              <div className="mt-3 border-t-2 border-dashed border-ink/25 pt-3 sm:hidden">
                <ConnectCta href="/claim" className="btn btn-ghost btn-sm w-full">
                  i am an heir
                </ConnectCta>
              </div>
            )}
          </MobileNav>
        </div>
      </nav>
    </div>
  );
}

function MarketingActions() {
  return (
    <div className="flex items-center gap-2">
      {/* Below `sm` this one moves into the hamburger, where it has room for its own row. */}
      <ConnectCta href="/claim" className="btn btn-ghost btn-sm hidden sm:inline-flex">
        i am an heir
      </ConnectCta>
      {/* Below 360px the full label is what pushes the hamburger through the bar's right
          edge, and the article is the cheapest word in it. */}
      <ConnectCta href="/setup" className="btn btn-sm whitespace-nowrap">
        <span className="min-[360px]:hidden">open estate</span>
        <span className="hidden min-[360px]:inline">open an estate</span>
      </ConnectCta>
    </div>
  );
}
