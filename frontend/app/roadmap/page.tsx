import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { SiteNav } from "@/components/layout/site-nav";
import { AcquisitionSection } from "@/components/roadmap/acquisition-section";
import { DocsSection } from "@/components/roadmap/docs-section";
import { PhasesSection } from "@/components/roadmap/phases-section";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Ring, Squiggle } from "@/components/ui/deco";
import { REPO_URL } from "@/lib/content/roadmap";

export const metadata: Metadata = {
  title: "herit — docs & roadmap",
  description:
    "The documents herit is checkable against, where the product goes after ETHOnline, and how it would reach its first users.",
};

export default function RoadmapPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-8 pt-14 sm:px-6">
          <Ring className="right-[7%] top-[18%] hidden md:block" size={50} />

          <div className="relative z-10 mx-auto max-w-6xl">
            <span className="tag tag-shadow bg-lavender">beyond the demo</span>
            <h1 className="mt-6 max-w-3xl">
              the docs, and{" "}
              <span className="relative inline-block">
                what happens next
                <Squiggle className="-bottom-4 left-0" size={280} fill="#E8635A" />
              </span>
            </h1>
            <p className="mt-9 max-w-2xl text-base leading-relaxed text-muted">
              herit was built in a hackathon, but the problem it picks is not a hackathon problem.
              this page is the honest version of both: exactly what exists today and where to read
              it, then what it would take to make this something a family could actually rely on —
              and how it would find the people who need it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-pill"
              >
                read the repo
                <ArrowRightIcon size={16} className="-rotate-45" />
              </a>
              <Link href="/#contracts" className="btn btn-ghost btn-pill">
                see the deployed contracts
              </Link>
            </div>
          </div>
        </section>

        <DocsSection />
        <PhasesSection />
        <AcquisitionSection />
      </main>
      <Footer />
    </>
  );
}
