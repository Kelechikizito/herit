import { Reveal } from "@/components/ui/reveal";
import { CONTRACTS, ENS_LAYER } from "@/lib/content/landing";
import { shortAddress } from "@/lib/estate";
import { explorerAddressUrl } from "@/lib/wagmi/explorer";

/** The contract set, and where each one stands in the build. */
export function ContractsSection() {
  return (
    <section id="contracts" className="relative scroll-mt-24 overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
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
              <article className="card-flat flex h-full flex-col p-5">
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
                <div className="mt-4 border-t-2 border-ink/10 pt-3">
                  <EtherscanLink address={contract.address} />
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-4 card-flat p-5">
            <h3 className="text-sm font-bold">the ENS layer under herit.eth</h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              deployed once and left alone by a herit redeploy. every grantor name and every heir
              record in the app lives inside these three.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {ENS_LAYER.map((entry) => (
                <div key={entry.name} className="min-w-0">
                  <dt className="mono text-[0.8rem] font-bold">{entry.name}</dt>
                  <dd className="mt-1 text-[0.78rem] leading-relaxed text-muted">{entry.body}</dd>
                  <dd className="mt-1.5">
                    <EtherscanLink address={entry.address} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** An address, linked to its Sepolia Etherscan page. Full address in the title, short on screen. */
function EtherscanLink({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className="mono inline-flex items-center gap-1 text-[0.75rem] font-bold underline decoration-2 underline-offset-4 hover:text-ink"
    >
      {shortAddress(address)}
      <span aria-hidden="true">↗</span>
      <span className="sr-only">on sepolia etherscan</span>
    </a>
  );
}
