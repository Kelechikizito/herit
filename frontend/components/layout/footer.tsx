import Link from "next/link";
import {
  FOOTER_BLURB,
  FOOTER_COLUMNS,
  FOOTER_DISCLAIMER,
  type NavLink,
} from "@/lib/content/navigation";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="px-4 pb-10 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[14px] border-2 border-ink bg-surface px-6 py-8 shadow-brut">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted">{FOOTER_BLURB}</p>
          </div>

          <div className="flex flex-wrap gap-10">
            {FOOTER_COLUMNS.map((column) => (
              <FooterColumn key={column.title} title={column.title} links={column.links} />
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t-2 border-ink pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{FOOTER_DISCLAIMER}</span>
          <span className="mono">ENS track · World track</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly NavLink[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <FooterLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const LINK_CLASS =
  "text-sm text-muted underline decoration-2 underline-offset-4 hover:text-ink";

function FooterLink({ href, label }: NavLink) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={LINK_CLASS}>
      {label}
    </Link>
  );
}
