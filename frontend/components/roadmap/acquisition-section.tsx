import { Reveal } from "@/components/ui/reveal";
import { Sparkle } from "@/components/ui/deco";
import { ACQUISITION } from "@/lib/content/roadmap";

/** Where the first users would come from, and why each channel is cheap to test. */
export function AcquisitionSection() {
  return (
    <section id="acquisition" className="relative scroll-mt-24 overflow-hidden px-4 py-16 sm:px-6">
      <Sparkle className="left-[6%] top-[10%]" size={26} fill="#7B6CF6" rotate={-12} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-purple">go to market</span>
          <h2 className="mt-5 max-w-2xl">nobody searches for this. so we go to them</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            inheritance is bought in a moment, not browsed for. every channel below is picked
            because it reaches someone already standing in that moment.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {ACQUISITION.map((play, index) => (
            <Reveal key={play.title} delay={index * 60}>
              <article className="card-flat flex h-full flex-col p-6">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-4 w-4 flex-shrink-0 rotate-45 border-2 border-ink ${play.accent}`}
                    aria-hidden="true"
                  />
                  <h3 className="text-lg">{play.title}</h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{play.body}</p>
                <p className="mono mt-4 border-t-2 border-ink/10 pt-3 text-[0.72rem] text-muted">
                  {play.channel}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
