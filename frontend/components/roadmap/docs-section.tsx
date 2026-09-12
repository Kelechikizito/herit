import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon } from "@/components/ui/icons";
import { DOC_LINKS, STACK } from "@/lib/content/roadmap";

/** Where to read the thing itself: the design doc, the addresses, the subgraph, the Solidity. */
export function DocsSection() {
  return (
    <section id="docs" className="relative scroll-mt-24 overflow-hidden px-4 py-16 sm:px-6">
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <span className="tag tag-shadow bg-teal">documentation</span>
          <h2 className="mt-5 max-w-2xl">read the source, not the pitch</h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            everything herit claims on the landing page is checkable. these are the documents it
            is checkable against.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_LINKS.map((doc, index) => (
            <Reveal key={doc.href} delay={index * 55}>
              <a
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="card-lift flex h-full flex-col p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`tag px-2 py-0.5 text-[0.65rem] ${doc.accent}`}>{doc.kind}</span>
                  <ArrowRightIcon size={16} className="-rotate-45" />
                </div>
                <h3 className="mono mt-3 text-[0.95rem] break-words">{doc.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{doc.body}</p>
              </a>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="card-flat mt-4 p-5">
            <h3 className="text-sm font-bold">what it is built on</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STACK.map((entry) => (
                <div key={entry.name} className="min-w-0">
                  <dt>
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.85rem] font-bold underline decoration-2 underline-offset-4"
                    >
                      {entry.name}
                    </a>
                  </dt>
                  <dd className="mt-0.5 text-[0.78rem] leading-relaxed text-muted">{entry.role}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
