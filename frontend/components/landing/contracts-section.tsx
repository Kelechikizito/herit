import { Reveal } from "@/components/ui/reveal";
import { CONTRACTS } from "@/lib/content/landing";

/** The contract set, and where each one stands in the build. */
export function ContractsSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6">
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-pink">under the hood</span>
          <h2 className="mt-5 max-w-2xl">five contracts on sepolia</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            ENSv2 lives on Sepolia and World ID&apos;s verifier lives on World Chain. herit
            bridges that gap with a narrow, single-purpose attestor rather than blocking the
            build on an oracle.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTRACTS.map((contract, index) => (
            <Reveal key={contract.name} delay={index * 55}>
              <article className="card-flat h-full p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="mono text-[0.95rem]">{contract.name}</h3>
                  <span
                    className={`tag px-2 py-0.5 text-[0.65rem] ${
                      contract.state === "deployed" ? "bg-teal" : "bg-cream"
                    }`}
                  >
                    {contract.state}
                  </span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{contract.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
