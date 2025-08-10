"use client";

import { type ReactNode } from "react";
import { baseSepolia, base } from "wagmi/chains";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

const wagmiConfig = createConfig({
  chains: [baseSepolia, base], // Support both testnet and mainnet
  connectors: [
    coinbaseWallet({
      appName: "onchainkit",
    }),
  ],
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  // Add better event watching configuration for Base
  pollingInterval: 1000, // Poll every 1 second
  batch: {
    multicall: true,
  },
});

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <MiniKitProvider
        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
        chain={baseSepolia}
        config={{
          appearance: {
            mode: "auto",
            theme: "mini-app-theme",
            name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
            logo: process.env.NEXT_PUBLIC_ICON_URL,
          },
        }}
      >
        {props.children}
      </MiniKitProvider>
    </WagmiProvider>
  );
}
