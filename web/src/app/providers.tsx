"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Email only: the people using Paperplane should never see a wallet.
        loginMethods: ["email"],
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
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
