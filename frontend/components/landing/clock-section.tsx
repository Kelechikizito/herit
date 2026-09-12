import { DotTrail, Sparkle } from "@/components/ui/deco";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/reveal";
import { CLOCK_STAGES } from "@/lib/content/landing";

/** Active → grace → unlocked, narrated. The transition is a pure function of the clock. */
export function ClockSection() {
  return (
    <section id="clock" className="relative scroll-mt-24 overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
      <Sparkle className="left-[6%] top-[14%] hidden sm:block" size={24} fill="#E8635A" rotate={-20} />
      <DotTrail className="right-[5%] bottom-[10%] hidden md:block" size={100} fill="#7B6CF6" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-lavender">the state machine</span>
          <h2 className="mt-5 max-w-2xl">two timers, three states, no committee</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            the transition is a pure function of the clock. herit cannot unlock your estate
            early, and no one has to be online for it to unlock on time.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CLOCK_STAGES.map((stage, index) => (
            <Reveal key={stage.name} delay={index * 80}>
              <article className="card relative h-full p-5 sm:p-6">
                {index < CLOCK_STAGES.length - 1 ? <StageArrow /> : null}

                <div className="flex items-center gap-3">
                  <span className={`icon-box ${stage.color}`}>
                    <stage.icon size={22} />
                  </span>
                  <div>
                    <h3 className="text-xl">{stage.name}</h3>
                    <p className="text-xs text-muted">{stage.lead}</p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-muted">{stage.body}</p>

                <p className="mono mt-5 border-t-2 border-ink pt-3 text-xs font-bold">
                  {stage.footer}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The connector between two stage cards, straddling the gap on wide screens. */
function StageArrow() {
  return (
    <span
      className="absolute -right-[19px] top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface md:flex"
      aria-hidden="true"
    >
      <ArrowRightIcon size={15} />
    </span>
  );
}
