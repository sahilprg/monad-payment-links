"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type Address } from "viem";
import { chain } from "./config";

/** The account Paperplane created for the signed-in person, once it exists. */
export function useAccount(): ConnectedWallet | undefined {
  const { wallets } = useWallets();
  return wallets.find((w) => w.walletClientType === "privy");
}

export async function walletClientFor(wallet: ConnectedWallet) {
  await wallet.switchChain(chain.id);
  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as Address,
    chain,
    transport: custom(provider),
  });
}
