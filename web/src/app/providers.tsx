"use client";

import { addRpcUrlOverrideToChain, PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

// Send the account's network requests through this app's own server.
const rpcUrl =
  typeof window === "undefined" ? monadTestnet.rpcUrls.default.http[0] : `${window.location.origin}/api/rpc`;
const chain = addRpcUrlOverrideToChain(monadTestnet, rpcUrl);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Email only: the people using Paperplane should never see a wallet.
        loginMethods: ["email"],
        defaultChain: chain,
        supportedChains: [chain],
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
          showWalletUIs: false,
        },
        appearance: {
          theme: "light",
          accentColor: "#27489E",
          landingHeader: "Sign in to Paperplane",
          loginMessage: "We'll email you a code. No password needed.",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
