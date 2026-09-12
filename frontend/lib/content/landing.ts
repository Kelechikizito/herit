import type { ComponentType } from "react";
import {
  ClockIcon,
  HeirIcon,
  type IconProps,
  PulseIcon,
  SelfieIcon,
  ShieldIcon,
  TreeIcon,
  UnlockIcon,
  VaultIcon,
} from "@/components/ui/icons";
import { ens, herit } from "@/lib/contracts/addresses";

type Icon = ComponentType<IconProps>;

export const PROBLEMS: readonly {
  broken: string;
  brokenBody: string;
  fix: string;
  fixBody: string;
  icon: Icon;
  color: string;
}[] = [
  {
    broken: "proof of life is just a timestamp",
    brokenBody:
      "classic dead-man's switches refresh a lastActive field on any transaction. a bot on a cron, a delegated signer, or an attacker holding your stolen key can all keep that clock alive forever while you are not.",
    fix: "a Selfie Check, not a signature",
    fixBody:
      "checking in requires a fresh World ID liveness and uniqueness proof scoped to your estate. a private key cannot look into a camera. whoever holds your key cannot pretend you are still here.",
    icon: SelfieIcon,
    color: "bg-teal",
  },
  {
    broken: "heirs are opaque addresses",
    brokenBody:
      "0x71c7…976f tells a grantor nothing, carries no verifiable link to a real person, and can be silently swapped. reviewing your own will becomes an exercise in trusting a hex string.",
    fix: "heirs are ENS subnames with roles",
    fixBody:
      "each heir gets son.alice.herit.eth inside a registry deployed for your estate, holding a relationship record, a share, and a claim role that ENSv2 itself enforces. readable, portable, and permissioned.",
    icon: TreeIcon,
    color: "bg-purple",
  },
];

export const JOURNEY_STEPS: readonly {
  title: string;
  body: string;
  icon: Icon;
  color: string;
}[] = [
  {
    title: "claim your estate name",
    body: "register alice.herit.eth in the grantor registry. herit deploys a dedicated ENSv2 registry for your estate in the same transaction, and holds only the root roles it needs to gate heirs later.",
    icon: TreeIcon,
    color: "bg-lavender",
  },
  {
    title: "name your heirs",
    body: "mint son.alice.herit.eth for each next-of-kin with a relationship record and a share in basis points. the claim role is deliberately withheld at registration — that withheld bit is the inheritance.",
    icon: HeirIcon,
    color: "bg-pink",
  },
  {
    title: "set the clock and fund the vault",
    body: "pick a check-in interval and a grace period, then escrow exactly what you intend to will. an opt-in vault, not a module over your whole wallet, so the custody boundary stays legible.",
    icon: VaultIcon,
    color: "bg-teal",
  },
  {
    title: "keep proving you are alive",
    body: "one Selfie Check per interval resets the clock. miss it and grace begins; miss grace and anyone may poke the registry, which grants the claim role to your heirs. no one has to remember to act.",
    icon: PulseIcon,
    color: "bg-yellow",
  },
];

/** The state machine, narrated. Mirrors `EstateStatus`. */
export const CLOCK_STAGES: readonly {
  name: string;
  color: string;
  icon: Icon;
  lead: string;
  body: string;
  footer: string;
}[] = [
  {
    name: "active",
    color: "bg-teal",
    icon: ShieldIcon,
    lead: "you checked in on time",
    body: "the estate is sealed. heirs can see their subname and their share, and can do nothing with either. the claim role does not sit on their name at all.",
    footer: "heirs: read-only",
  },
  {
    name: "grace",
    color: "bg-yellow",
    icon: ClockIcon,
    lead: "a window closed with no check-in",
    body: "the safety margin for travel, illness, or a bad network day. one valid Selfie Check here returns the estate to active with nothing lost. heirs are notified, not empowered.",
    footer: "reversible by you",
  },
  {
    name: "unlocked",
    color: "bg-coral",
    icon: UnlockIcon,
    lead: "grace lapsed too",
    body: "anyone may poke the registry — no privileged caller, no herit intervention. ROLE_HEIR_CLAIM lands on each heir subname. each heir then passes their own Selfie Check to claim their share.",
    footer: "heirs: claimable",
  },
];

/** The two hackathon tracks, and why each is load-bearing rather than a badge. */
export const TRACKS: readonly {
  accent: string;
  badge: string;
  title: string;
  points: readonly string[];
  icon: Icon;
}[] = [
  {
    accent: "bg-lavender",
    badge: "ENS track",
    title: "ENSv2 registries as the permission system",
    points: [
      "one registry deployed per estate through the Verifiable Factory, at an address derivable before it exists",
      "heirs are subnames holding herit.relationship and herit.share resolver records",
      "enhanced access control is a real bit — ROLE_HEIR_CLAIM, withheld at registration and granted on unlock",
      "the grantor is denied ROLE_SET_SUBREGISTRY, so the estate registry can never be swapped for one they control",
    ],
    icon: TreeIcon,
  },
  {
    accent: "bg-teal",
    badge: "World track",
    title: "Selfie Check on both sides of the handover",
    points: [
      "grantor liveness: a recurring proof-of-personhood that gates whether the estate stays sealed",
      "heir claim: a one-time uniqueness proof, so one human cannot farm several heir slots",
      "proofs are scoped per action and nonce, so a check-in can never be replayed as a claim",
      "verified through Cloud Verify, then carried to Sepolia as an EIP-712 attestation with an expiry",
    ],
    icon: SelfieIcon,
  },
];

/**
 * The contract set from ARCHITECTURE.md §6.2, each with its Sepolia address.
 *
 * Addresses come from `lib/contracts/addresses.ts` rather than being retyped here, so a redeploy
 * updates the landing page and the app's call sites in one edit.
 */
export const CONTRACTS: readonly {
  name: string;
  body: string;
  address: `0x${string}`;
  state: "deployed" | "in progress";
}[] = [
  {
    name: "AccessControlGate",
    body: "opens estates, registers heirs, grants the claim role. holds root roles on every estate registry and never holds funds.",
    address: herit.accessControlGate,
    state: "deployed",
  },
  {
    name: "HeritRegistry",
    body: "the per-estate state machine and check-in clock. the only caller permitted to unlock an heir.",
    address: herit.heritRegistry,
    state: "deployed",
  },
  {
    name: "LivenessAttestor",
    body: "verifies the backend's EIP-712 attestation that a Selfie Check passed, replay-protected by action, nonce and expiry.",
    address: herit.livenessAttestor,
    state: "deployed",
  },
  {
    name: "HeritVault",
    body: "opt-in escrow for exactly the assets you intend to will. ETH and ERC-20 for the hackathon build.",
    address: herit.heritVault,
    state: "deployed",
  },
  {
    name: "ClaimManager",
    body: "the heir-facing entrypoint. checks unlock, attestation and subname control, then releases the share.",
    address: herit.claimManager,
    state: "deployed",
  },
];

/**
 * The ENS layer every estate hangs off. Deployed once at Checkpoint 5 and left alone by a Herit
 * redeploy, which is why it is listed apart from the five above.
 */
export const ENS_LAYER: readonly {
  name: string;
  body: string;
  address: `0x${string}`;
}[] = [
  {
    name: "herit.eth registry",
    body: "registry A, attached as the subregistry of herit.eth. one subname per grantor — alice.herit.eth lives here.",
    address: ens.grantorRegistry,
  },
  {
    name: "PermissionedResolver",
    body: "holds every heir's addr(60), herit.relationship and herit.share records across all estates.",
    address: ens.resolver,
  },
  {
    name: "ETHRegistry",
    body: "ENSv2's .eth registry from the frozen hackathon deployment. herit.eth itself is registered here.",
    address: ens.ethRegistry,
  },
];

/** The three one-liners under the hero call to action. */
export const HERO_TRUST_POINTS: readonly string[] = [
  "a stolen key cannot pass a liveness check",
  "one human, one heir slot",
  "grace period for false alarms",
];
