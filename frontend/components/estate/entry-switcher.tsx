import Link from "next/link";
import type { EntryLink } from "@/lib/estate";

/**
 * Every estate or heir slot the wallet holds, as links. Switching is a navigation, so the choice
 * survives a reload. Renders nothing for a wallet holding only one.
 */
export function EntrySwitcher({
  label,
  links,
  current,
}: {
  /** Names the nav for screen readers: "your estates". */
  label: string;
  links: EntryLink[];
  current: EntryLink;
}) {
  if (links.length < 2) return null;

  return (
    <nav aria-label={label} className="mt-5">
      <EntryLinks links={links} current={current.href} />
    </nav>
  );
}

export function EntryLinks({
  links,
  current,
  className = "",
}: {
  links: EntryLink[];
  current?: string;
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((link) => {
        const active = link.href === current;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`btn btn-sm mono ${active ? "" : "btn-ghost"}`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
