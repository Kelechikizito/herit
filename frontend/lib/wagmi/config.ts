import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
import { sepolia } from "./chains";

/**
 * wagmi config. (Sepolia only.)
 */
export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    // Falls back to the chain's public RPC when unset, which rate-limits under a demo.
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
