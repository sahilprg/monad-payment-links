// Server only. The helper wallet that pays network fees so users never do.

import { createWalletClient, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain } from "./config";
import { transport } from "./transport";

export function getRelayer() {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("RELAYER_PRIVATE_KEY is missing or not a valid key.");
  }
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain,
    transport,
  });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
