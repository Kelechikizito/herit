import Link from "next/link";
import { Sparkle, Star } from "@/components/ui/deco";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/reveal";

/** The closing panel. */
export function CallToAction() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-8 sm:px-6">
      <div className="relative mx-auto max-w-6xl">
        <Star className="-left-4 -top-4 z-20" size={40} fill="#FFE566" rotate={-14} />
        <Sparkle className="-right-2 -top-2 z-20" size={30} fill="#E8635A" rotate={16} />

        <Reveal>
          <div className="relative overflow-hidden rounded-[14px] border-2 border-ink bg-lavender px-6 py-14 text-center shadow-brut-lg sm:px-10">
            <p className="font-[family-name:var(--font-caveat)] text-2xl font-bold">
              takes about four minutes
            </p>
            <h2 className="mx-auto mt-2 max-w-2xl">
              set it up once, then just keep being alive
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-ink/70">
              open an estate on Sepolia, name your heirs, and let the clock do the rest.
              demo timers run in minutes so you can watch the whole handover happen.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/setup" className="btn btn-pill">
                open an estate
                <ArrowRightIcon size={16} />
              </Link>
              <Link href="/claim" className="btn btn-ghost btn-pill">
                check a claim
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
