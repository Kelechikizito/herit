"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/** A nav link with its href already resolved — `SiteNav` owns the `?estate=` carrying. */
export type ResolvedLink = { href: string; label: string; active: boolean };

/**
 * The navbar below the breakpoint where the link row fits: a hamburger that drops the same
 * links, plus whatever calls to action the bar itself had no room for, into a card under it.
 *
 * Dismissal mirrors the wallet menu — outside pointer, Escape — plus the two ways a menu of links
 * gets dismissed: the row itself is clicked, or a route change lands. The calls to action are left
 * to the route change, because one of them may have opened the wallet picker from inside this
 * panel and closing on click would unmount the picker with it.
 */
export function MobileNav({
  links,
  className = "",
  children,
}: {
  links: readonly ResolvedLink[];
  /** Breakpoint utilities that hide the toggle once the full row is shown. */
  className?: string;
  /** Rendered under the links, for the calls to action the bar itself has no room for. */
  children?: React.ReactNode;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // The route the menu was opened on, rather than a boolean: a landed navigation should close
  // it, and deriving that from the pathname beats an effect that sets state after the render.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = useCallback(() => setOpenedOn(null), []);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) close();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  return (
    <div className={`relative ${className}`} ref={wrapper}>
      <button
        type="button"
        className="btn btn-ghost btn-sm px-2.5"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "close menu" : "open menu"}
      >
        {open ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
      </button>

      {open ? (
        <div
          className="card absolute right-0 top-[calc(100%+12px)] w-[min(17rem,calc(100vw-2.5rem))] p-3"
          role="menu"
          aria-label="site"
        >
          <div className="flex flex-col gap-0.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                aria-current={link.active ? "page" : undefined}
                onClick={close}
                className={`menu-row ${link.active ? "border-ink bg-yellow" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {children}
        </div>
      ) : null}
    </div>
  );
}
