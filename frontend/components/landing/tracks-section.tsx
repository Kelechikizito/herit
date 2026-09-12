import { Blob, Star } from "@/components/ui/deco";
import { Reveal } from "@/components/ui/reveal";
import { TRACKS } from "@/lib/content/landing";

/** Why both hackathon tracks are load-bearing rather than badges. */
export function TracksSection() {
  return (
    <section id="tracks" className="relative scroll-mt-24 overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
      <Star className="right-[4%] top-[12%]" size={36} fill="#FFE566" rotate={12} />
      <Blob className="-left-10 bottom-[14%]" size={80} fill="#C4B5FD" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-2xl">
            two tracks, because the product genuinely needs both
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            neither integration is a badge. remove either one and herit stops being safe to
            use.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {TRACKS.map((track, index) => (
            <Reveal key={track.badge} delay={index * 90}>
              <TrackCard {...track} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrackCard({
  accent,
  badge,
  title,
  points,
  icon: Icon,
}: (typeof TRACKS)[number]) {
  return (
    <article className="card h-full overflow-hidden">
      <div className={`flex items-center gap-3 border-b-2 border-ink ${accent} px-5 py-5 sm:px-6`}>
        <span className="icon-box bg-surface">
          <Icon size={22} />
        </span>
        <div>
          <p className="text-[0.72rem] font-bold tracking-wide">{badge}</p>
          <h3 className="mt-0.5">{title}</h3>
        </div>
      </div>
      <ul className="space-y-3.5 px-5 py-5 sm:px-6 sm:py-6">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span
              className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rotate-45 border-2 border-ink bg-yellow"
              aria-hidden="true"
            />
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}
