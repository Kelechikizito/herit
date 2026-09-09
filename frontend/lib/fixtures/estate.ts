import { DAY, type Estate, type Heir, HOUR, type LogEntry } from "@/lib/estate";

/* Sample estate content for the design screens. not app state.*/

/** fake connected address. */
export const CONNECTED_ADDRESS = "0x8fA3B21c4Dd0b9E1c73eA5f10c2B9d4aE6913C77";

/** The heir the claim screen is signed in as. */
export const SIGNED_IN_HEIR = "son";

/**
 * The instant the design screens are drawn at.
 */
export const DESIGN_NOW = Math.floor(Date.UTC(2026, 2, 14, 9, 42) / 1000);

const HEIRS: Heir[] = [
  {
    label: "son",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    relationship: "son",
    shareBps: 4_000,
    claimed: false,
  },
  {
    label: "kate",
    address: "0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB",
    relationship: "spouse",
    shareBps: 3_500,
    claimed: false,
  },
  {
    label: "mara",
    address: "0x9aC1f0E4b7D2385Ae6C31b90fD54A7182ce6B043",
    relationship: "daughter",
    shareBps: 1_500,
    claimed: false,
  },
];

/** Log entries, as offsets back from the last check-in. */
function sampleLog(lastCheckIn: number): LogEntry[] {
  return [
    {
      id: "l6",
      stamp: lastCheckIn,
      kind: "checkin",
      text: "selfie check passed — attestation accepted, clock reset",
    },
    {
      id: "l5",
      stamp: lastCheckIn - 12 * DAY,
      kind: "deposit",
      text: "vault funded — 4.0 ETH escrowed in HeritVault",
    },
    {
      id: "l4",
      stamp: lastCheckIn - 30 * DAY,
      kind: "checkin",
      text: "selfie check passed — attestation accepted, clock reset",
    },
    {
      id: "l3",
      stamp: lastCheckIn - 45 * DAY,
      kind: "heir",
      text: "heir registered — mara.alice.herit.eth, 15% share, claim role withheld",
    },
    {
      id: "l2",
      stamp: lastCheckIn - 45 * DAY - 3 * 60,
      kind: "heir",
      text: "heir registered — kate.alice.herit.eth, 35% share, claim role withheld",
    },
    {
      id: "l1",
      stamp: lastCheckIn - 45 * DAY - 7 * 60,
      kind: "opened",
      text: "estate opened — alice.herit.eth registered, registry B deployed",
    },
  ];
}

/** A healthy estate, roughly two thirds through a 30-day window. */
export function sampleEstate(now: number = DESIGN_NOW): Estate {
  const lastCheckIn = now - (18 * DAY + 20 * HOUR);

  return {
    label: "alice",
    grantor: CONNECTED_ADDRESS,
    estateRegistry: "0x2b4c9E7f1A6d38B05Cc4e21F9a7D5308eB16C0aF",
    // Stands in for `statusOf`, which is where the real value comes from.
    status: "active",
    clock: {
      lastCheckIn,
      checkInInterval: 30 * DAY,
      graceDuration: 7 * DAY,
      storedStatus: "active",
    },
    vaultEth: 12.4,
    heirs: HEIRS.map((heir) => ({ ...heir })),
    log: sampleLog(lastCheckIn),
  };
}

/**
 * The same estate after grace lapsed, used by the heir-facing claim screen.
 *
 * `storedStatus` is `unlocked` because someone has already poked it — which is what makes the
 * heir's claim role live. An estate whose clock has lapsed but which nobody has poked still
 * reads as `active` on-chain, and that gap is deliberate.
 */
export function unlockedEstate(now: number = DESIGN_NOW): Estate {
  const base = sampleEstate(now);
  const lastCheckIn = now - 39 * DAY;

  return {
    ...base,
    status: "unlocked",
    clock: { ...base.clock, lastCheckIn, storedStatus: "unlocked" },
    heirs: base.heirs.map((heir) =>
      heir.label === "kate" ? { ...heir, claimed: true } : heir,
    ),
    log: sampleLog(lastCheckIn),
  };
}
