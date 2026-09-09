import type { Chain } from "viem";
import { sepolia as viemSepolia } from "viem/chains";

/**
 * ENSv2 Universal Resolver for ETHOnline2026 hackathon (`UpgradableUniversalResolverProxy`).
 * Overriding it on chain object rather than per call site.
 */
export const ENS_UNIVERSAL_RESOLVER = "0xd26f2040d083af1cd2962ba303f4bea0c4faf142" as const;

export const sepolia = {
  ...viemSepolia,
  contracts: {
    ...viemSepolia.contracts,
    ensUniversalResolver: { address: ENS_UNIVERSAL_RESOLVER },
  },
} as const satisfies Chain;
