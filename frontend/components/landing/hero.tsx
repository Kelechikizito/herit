import Link from "next/link";
import { EstatePreviewCard } from "@/components/landing/estate-preview-card";
import { Blob, DotTrail, Ring, Sparkle, Squiggle, Star } from "@/components/ui/deco";
import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import { Reveal } from "@/components/ui/reveal";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { HERO_TRUST_POINTS } from "@/lib/content/landing";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-24">
      <Star className="left-[4%] top-[12%] hidden deco-spin sm:block" size={40} fill="#FFE566" />
      <Sparkle className="left-[10%] bottom-[18%] hidden sm:block" size={26} fill="#7B6CF6" rotate={-12} />
      <Blob className="right-[3%] top-[8%] deco-bob" size={70} fill="#C4B5FD" />
      <DotTrail className="bottom-[8%] left-[42%] hidden lg:block" size={110} fill="#E8635A" />
      <Ring className="right-[8%] bottom-[12%] hidden md:block" size={52} />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <span className="tag tag-shadow bg-yellow">
            ETHOnline 2026 · ENS track + World track
          </span>

          <h1 className="mt-6">
            your keys
            <br />
            shouldn&apos;t die
            <br />
            <span className="relative inline-block">
              with you.
              <Squiggle className="-bottom-3 left-0 h-auto w-[165px] sm:-bottom-4 sm:w-[240px]" size={240} fill="#E8635A" />
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:mt-7">
            herit hands your on-chain estate to named next-of-kin — but only once you stop
            proving you are alive. heirs are <strong className="text-ink">ENS subnames</strong>{" "}
            carrying real permissions, not raw addresses. liveness is a{" "}
            <strong className="text-ink">World ID Selfie Check</strong>, not a timestamp any
            bot can ping.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ConnectCta href="/setup" className="btn btn-pill">
              open an estate
              <ArrowRightIcon size={16} />
            </ConnectCta>
            <Link href="/dashboard" className="btn btn-ghost btn-pill">
              see a live estate
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium sm:mt-9">
            {HERO_TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <IconCircle size="2xs" accent="bg-teal">
                  <CheckIcon size={11} />
                </IconCircle>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <Reveal>
          <EstatePreviewCard />
        </Reveal>
      </div>
    </section>
  );
}
