import type { Estate } from "@/lib/estate";

/**
 * Sample estate content for the design screens.
 *
 * These are design fixtures, not app state. Everything the screens display as if it were read
 * from Sepolia lives here and nowhere else, so wiring real reads in later means replacing this
 * module — not touching a component.
 */

/** The wallet the app shell shows as connected. */
export const CONNECTED_ADDRESS = "0x8fA3B21c4Dd0b9E1c73eA5f10c2B9d4aE6913C77";

/** The heir the claim screen is signed in as. */
export const SIGNED_IN_HEIR = "son";

export const SAMPLE_ESTATE: Estate = {
  label: "alice",
  grantor: CONNECTED_ADDRESS,
  estateRegistry: "0x2b4c9E7f1A6d38B05Cc4e21F9a7D5308eB16C0aF",
  status: "active",
  checkInInterval: "30 days",
  graceDuration: "7 days",
  remaining: "11d 04h",
  progress: 0.62,
  lastCheckIn: "14 mar, 09:42",
  windowCloses: "13 apr, 09:42",
  unlocksAt: "20 apr, 09:42",
  vaultEth: 12.4,
  heirs: [
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
  ],
  log: [
    {
      id: "l6",
      stamp: "14 mar, 09:42",
      kind: "checkin",
      text: "selfie check passed — attestation accepted, clock reset",
    },
    {
      id: "l5",
      stamp: "02 mar, 11:08",
      kind: "deposit",
      text: "vault funded — 4.0 ETH escrowed in HeritVault",
    },
    {
      id: "l4",
      stamp: "12 feb, 09:40",
      kind: "checkin",
      text: "selfie check passed — attestation accepted, clock reset",
    },
    {
      id: "l3",
      stamp: "28 jan, 16:22",
      kind: "heir",
      text: "heir registered — mara.alice.herit.eth, 15% share, claim role withheld",
    },
    {
      id: "l2",
      stamp: "28 jan, 16:19",
      kind: "heir",
      text: "heir registered — kate.alice.herit.eth, 35% share, claim role withheld",
    },
    {
      id: "l1",
      stamp: "28 jan, 16:15",
      kind: "opened",
      text: "estate opened — alice.herit.eth registered, registry B deployed",
    },
  ],
};

/** The same estate after grace lapsed, used by the heir-facing claim screen. */
export const UNLOCKED_ESTATE: Estate = {
  ...SAMPLE_ESTATE,
  status: "unlocked",
  remaining: "00:00",
  progress: 1,
  heirs: SAMPLE_ESTATE.heirs.map((heir) =>
    heir.label === "kate" ? { ...heir, claimed: true } : heir,
  ),
};

/** Copy the claim screen shows about the unlock itself, alongside `UNLOCKED_ESTATE`. */
export const UNLOCK_SUMMARY = {
  since: "unlocked 2 days ago",
  graceLapsed: "grace lapsed on 20 apr",
} as const;
