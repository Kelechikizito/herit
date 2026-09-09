import type { EstateStatus } from "@/lib/estate/types";

export const heritRegistryAbi = [
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{ name: "estateId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "estateOf",
    stateMutability: "view",
    inputs: [{ name: "estateId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "lastCheckIn", type: "uint64" },
          { name: "checkInInterval", type: "uint64" },
          { name: "graceDuration", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isAvailable",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "pokeExpiry",
    stateMutability: "nonpayable",
    inputs: [{ name: "estateId", type: "uint256" }],
    outputs: [],
  },
] as const;


export const STATUS_BY_INDEX = ["active", "grace", "unlocked"] as const satisfies readonly EstateStatus[];

export function toEstateStatus(value: number): EstateStatus {
  const status = STATUS_BY_INDEX[value];
  if (status === undefined) {
    throw new Error(`HeritRegistry returned an unknown Status: ${value}`);
  }
  return status;
}

export const HERIT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_HERIT_REGISTRY_ADDRESS as
  | `0x${string}`
  | undefined;
