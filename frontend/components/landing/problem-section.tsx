import { Sparkle, Star } from "@/components/ui/deco";
import { Reveal } from "@/components/ui/reveal";
import { PROBLEMS } from "@/lib/content/landing";

/** The two failure modes every dead-man's switch shares, each answered on the same card. */
export function ProblemSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6">
      <Sparkle className="right-[6%] top-[10%]" size={28} fill="#FFE566" rotate={20} />
      <Star className="left-[5%] bottom-[12%]" size={30} fill="#4ECDC4" rotate={-15} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <h2 className="max-w-2xl">
            every dead-man&apos;s switch breaks in the same two places
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            crypto inheritance is not a hard contract problem. it is an identity problem
            wearing a contract costume — and it fails twice.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {PROBLEMS.map((problem, index) => (
            <Reveal key={problem.broken} delay={index * 90}>
              <ProblemCard {...problem} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemCard({
  broken,
  brokenBody,
  fix,
  fixBody,
  icon: Icon,
  color,
}: (typeof PROBLEMS)[number]) {
  return (
    <article className="card h-full overflow-hidden">
      <div className="border-b-2 border-ink bg-cream px-6 py-5">
        <span className="tag bg-surface text-[0.7rem]">the usual failure</span>
        <h3 className="mt-3 text-lg">{broken}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{brokenBody}</p>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <span className={`icon-box ${color}`}>
            <Icon size={22} />
          </span>
          <div>
            <h3 className="text-lg">{fix}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{fixBody}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
