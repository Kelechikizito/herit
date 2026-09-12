/**
 * What the `/roadmap` page says: where to read the source, where the product goes after the
 * hackathon, and how it would find its first users.
 *
 * Kept beside `landing.ts` because it is the same kind of thing — prose the marketing pages
 * render, with no runtime behaviour of its own.
 */

/** Every doc link points at `main`, so a link stays valid as the branch moves. */
const REPO = "https://github.com/Kelechikizito/herit";
const BLOB = `${REPO}/blob/main`;
const TREE = `${REPO}/tree/main`;

export const REPO_URL = REPO;

export const DOC_LINKS: readonly {
  name: string;
  href: string;
  body: string;
  kind: string;
  accent: string;
}[] = [
  {
    name: "ARCHITECTURE.md",
    href: `${BLOB}/ARCHITECTURE.md`,
    body: "the design document. why proof of life is a Selfie Check and not a timestamp, what each of the five contracts owns, the four key flows, and the security assumptions behind the backend attestor.",
    kind: "start here",
    accent: "bg-lavender",
  },
  {
    name: "README.md",
    href: `${BLOB}/README.md`,
    body: "the working notes this project started from — the original problem statement and the open questions, including the ones we deliberately left unanswered for the hackathon.",
    kind: "readme",
    accent: "bg-pink",
  },
  {
    name: "documents/deployments.md",
    href: `${BLOB}/documents/deployments.md`,
    body: "every address and transaction hash on Sepolia: the five herit contracts, the ENS layer under herit.eth, and the frozen ENSv2 hackathon set they are wired to.",
    kind: "addresses",
    accent: "bg-teal",
  },
  {
    name: "frontend/subgraph",
    href: `${TREE}/frontend/subgraph`,
    body: "the subgraph that feeds the live dashboard — schema, manifest and mappings for every event the five contracts emit.",
    kind: "indexing",
    accent: "bg-yellow",
  },
  {
    name: "src/",
    href: `${TREE}/src`,
    body: "the Solidity itself. a Foundry project whose five contracts deploy as one nonce sequence, all verified on Sepolia Etherscan.",
    kind: "contracts",
    accent: "bg-purple",
  },
  {
    name: "the repository",
    href: REPO,
    body: "everything above in one place, including the Foundry tests, the deploy scripts and the checkpoint guides recording how each piece was brought up.",
    kind: "github",
    accent: "bg-cream",
  },
];

/** The stack, credited. Each entry links to the thing itself, not to our use of it. */
export const STACK: readonly { name: string; href: string; role: string }[] = [
  { name: "ENSv2", href: "https://ens.domains", role: "heir subnames, and the roles that gate them" },
  { name: "World ID", href: "https://world.org/world-id", role: "Selfie Check liveness and uniqueness" },
  {
    name: "The Graph",
    href: "https://thegraph.com",
    role: "indexes every herit event — the live dashboard and the estate explorer read from it",
  },
  { name: "Foundry", href: "https://book.getfoundry.sh", role: "contracts, tests and deploy scripts" },
  { name: "Next.js", href: "https://nextjs.org", role: "this app, with wagmi and viem underneath" },
];

/**
 * The roadmap. Phase 0 is what anyone can verify on Sepolia today; everything after it is
 * intent, and is written as intent rather than as a promise.
 */
export const PHASES: readonly {
  phase: string;
  title: string;
  horizon: string;
  accent: string;
  done: boolean;
  items: readonly string[];
}[] = [
  {
    phase: "phase 0",
    title: "the hackathon build",
    horizon: "shipped",
    accent: "bg-teal",
    done: true,
    items: [
      "five contracts live and verified on Sepolia, deployed as one set",
      "an ENSv2 registry per estate, heirs minted as subnames carrying relationship and share records",
      "ROLE_HEIR_CLAIM withheld at registration and granted on unlock — the withheld bit is the inheritance",
      "Selfie Check on both sides: the grantor's recurring check-in and the heir's one-time claim",
      "a subgraph indexing every event, so the dashboard and the public estate explorer are live rather than mocked",
    ],
  },
  {
    phase: "phase 1",
    title: "from demo to something worth trusting",
    horizon: "next three months",
    accent: "bg-yellow",
    done: false,
    items: [
      "a reminder service — email, push and World App notification before a window closes. the contract stays the source of truth; a missed reminder must never be the reason an estate unlocks",
      "Safe{Wallet} module integration, so an estate can be a grantor's existing smart account rather than a separate willed deposit. this is the real path to inheriting a whole wallet",
      "a guardian committee: a few grantor-nominated, World ID-verified humans who can veto an unlock inside a time-boxed window, never indefinitely",
      "an external audit of the five contracts, and a public bug bounty, before any mainnet funds",
      "the World App mini app shell, so the whole flow runs where verified humans already are",
    ],
  },
  {
    phase: "phase 2",
    title: "mainnet, and removing ourselves from the trust path",
    horizon: "when ENSv2 reaches mainnet",
    accent: "bg-lavender",
    done: false,
    items: [
      "on-chain World ID verification once one chain hosts both the verifier and ENSv2, retiring the backend attestor as a trust assumption",
      "multi-asset and multi-chain vaults — NFTs, LP positions, and estates that span more than one chain",
      "per-heir rules beyond a flat share: token-scoped allocations, staged release, and heirs who are themselves estates",
      "a liveness cadence tuned to risk, so a large estate checks in more often than a small one",
    ],
  },
  {
    phase: "phase 3",
    title: "the part that is a business, not a protocol",
    horizon: "later",
    accent: "bg-pink",
    done: false,
    items: [
      "a legal wrapper — pairing the on-chain estate with a jurisdiction-aware document, so an unlock is recognised off-chain too",
      "an estate-planner and fiduciary channel: the professionals families already trust with this decision",
      "custodian and exchange integrations, so assets that are not self-custodied can still name an heir",
    ],
  },
];

/**
 * How this finds users. Ordered by how cheaply each channel can be tested, not by how large it
 * might eventually be — the first two are reachable with the build as it stands.
 */
export const ACQUISITION: readonly {
  title: string;
  body: string;
  channel: string;
  accent: string;
}[] = [
  {
    title: "distribute inside World App",
    body: "herit's core requirement — a verified, living human — is the one thing every World App user has already satisfied. shipping as a mini app puts the product in front of an audience pre-qualified for the exact primitive it depends on, with no wallet to install and no gas to explain.",
    channel: "World App mini app store",
    accent: "bg-teal",
  },
  {
    title: "start with people who already own a name",
    body: "an ENS holder has already decided their on-chain identity is worth paying for. for them herit is one more subname under a name they own, not a new account — the shortest distance between hearing the pitch and signing the first transaction.",
    channel: "ENS community and name-holder outreach",
    accent: "bg-lavender",
  },
  {
    title: "be a feature inside wallets, not only a destination",
    body: "nobody wakes up wanting to do estate planning. it becomes real in the moment someone is already looking at their balance. a “name an heir” entry point inside wallets and Safe apps meets that moment, and makes herit distribution-led rather than search-led.",
    channel: "wallet and Safe app integrations",
    accent: "bg-yellow",
  },
  {
    title: "sell the problem, not the mechanism",
    body: "the market is not people searching for ENS subname inheritance. it is people who have read one more story about coins buried with their owner. writing plainly about that — and about why a dead-man's switch a bot can ping is worse than nothing — is what turns a stranger into someone who opens an estate.",
    channel: "content, post-mortems, founder communities",
    accent: "bg-pink",
  },
  {
    title: "go where the loss is already priced",
    body: "DAO treasuries with one signer, funds holding keys on behalf of other people, and long-term holders with no succession plan all already treat this as an unpriced risk. they are a small, reachable, high-intent set of first customers.",
    channel: "direct outreach to DAOs and funds",
    accent: "bg-purple",
  },
];

/** How it would make money. Stated once, plainly, because a roadmap without it is a wish. */
export const BUSINESS_MODEL =
  "opening an estate stays free — a product nobody has heard of cannot also charge at the door. revenue comes from what only matters once the product has worked: a basis-point fee on assets released at claim, and a subscription for the reminder and guardian services that make missing a window unlikely in the first place.";
