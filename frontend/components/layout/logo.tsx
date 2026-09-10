import Link from "next/link";
import { PulseIcon } from "@/components/ui/icons";

/** The wordmark, always a link home. Used by the navbar and the footer. */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 no-underline"
      aria-label="herit, home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border-2 border-ink bg-coral text-white shadow-brut-xs">
        <PulseIcon size={18} />
      </span>
      <span className="text-xl font-extrabold tracking-tight">herit</span>
    </Link>
  );
}
