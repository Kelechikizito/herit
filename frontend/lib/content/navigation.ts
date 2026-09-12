/** Where the two navbar variants point, and what the footer lists. */

export type NavLink = { href: string; label: string };

export const MARKETING_LINKS: readonly NavLink[] = [
  { href: "/#how", label: "how it works" },
  { href: "/#clock", label: "the clock" },
  { href: "/#estates", label: "live estates" },
  { href: "/#tracks", label: "tracks" },
  { href: "/#contracts", label: "contracts" },
  { href: "/roadmap", label: "roadmap" },
];

export const APP_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/heirs", label: "heirs" },
  { href: "/claim", label: "claim" },
];

export const FOOTER_COLUMNS: readonly { title: string; links: readonly NavLink[] }[] = [
  {
    title: "product",
    links: [
      { href: "/setup", label: "open an estate" },
      { href: "/dashboard", label: "grantor dashboard" },
      { href: "/heirs", label: "manage heirs" },
      { href: "/claim", label: "heir claim" },
      { href: "/roadmap", label: "docs & roadmap" },
    ],
  },
  {
    title: "built on",
    links: [
      { href: "https://ens.domains", label: "ENSv2 registries" },
      { href: "https://world.org/world-id", label: "World ID" },
      { href: "https://thegraph.com", label: "The Graph" },
      { href: "https://book.getfoundry.sh", label: "Foundry" },
      { href: "https://sepolia.etherscan.io", label: "Sepolia" },
    ],
  },
];

export const FOOTER_BLURB =
  "next-of-kin inheritance gated by proof of life. built for ETHOnline 2026 on ENSv2 and World ID.";

export const FOOTER_DISCLAIMER =
  "herit. hackathon build, Sepolia testnet only. not financial or legal advice.";
