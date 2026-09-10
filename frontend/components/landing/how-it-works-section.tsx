import { Blob, Star } from "@/components/ui/deco";
import { Reveal } from "@/components/ui/reveal";
import { JOURNEY_STEPS } from "@/lib/content/landing";

/** The four steps of setup, told once here and walked for real in `/setup`. */
export function HowItWorksSection() {
  return (
    <section id="how" className="relative scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6">
      <Blob className="-left-8 top-[20%]" size={90} fill="#F9A8B8" />
      <Star className="right-[8%] top-[8%] deco-spin" size={34} fill="#7B6CF6" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-teal">setup takes four steps</span>
          <h2 className="mt-5 max-w-2xl">how it works</h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {JOURNEY_STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 70}>
              <article className="card-flat card-lift h-full p-6">
                <div className="flex items-center gap-3">
                  <span className={`icon-box ${step.color}`}>
                    <step.icon size={22} />
                  </span>
                  <span className="mono text-3xl font-extrabold text-muted">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
