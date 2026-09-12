import { Blob, Star } from "@/components/ui/deco";
import { CheckIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/reveal";
import { BUSINESS_MODEL, PHASES } from "@/lib/content/roadmap";

/** The roadmap proper: what is already true, and what would have to happen next. */
export function PhasesSection() {
  return (
    <section id="phases" className="relative scroll-mt-24 overflow-hidden px-4 py-16 sm:px-6">
      <Star className="right-[5%] top-[8%]" size={34} fill="#FFE566" rotate={14} />
      <Blob className="-left-10 bottom-[20%]" size={78} fill="#C4B5FD" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-yellow">roadmap</span>
          <h2 className="mt-5 max-w-2xl">how a demo becomes something you would put real money behind</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            phase 0 is on Sepolia now and can be verified line by line. everything after it is
            stated as intent, in the order the constraints actually lift.
          </p>
        </Reveal>

        <ol className="mt-12 space-y-5">
          {PHASES.map((phase, index) => (
            <Reveal key={phase.phase} delay={index * 70}>
              <li className="card overflow-hidden">
                <div
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink ${phase.accent} px-6 py-4`}
                >
                  <span className="mono text-[0.72rem] font-bold tracking-wide">{phase.phase}</span>
                  <h3 className="flex-1 text-xl">{phase.title}</h3>
                  <span className="tag bg-surface px-2 py-0.5 text-[0.65rem]">
                    {phase.done ? <CheckIcon size={11} className="mr-1 inline-block" /> : null}
                    {phase.horizon}
                  </span>
                </div>
                <ul className="space-y-3.5 px-6 py-6">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rotate-45 border-2 border-ink ${
                          phase.done ? "bg-teal" : "bg-surface"
                        }`}
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={120}>
          <div className="card-flat mt-5 p-6">
            <h3 className="text-sm font-bold">and how it pays for itself</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{BUSINESS_MODEL}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
