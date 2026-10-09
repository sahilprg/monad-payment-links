// Helpers for creating and claiming payment links with viem.
// The one-time key lives only in the link. Put it after the "#" so browsers
// never send it to your server: https://yourapp.xyz/claim#0xabc...

import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const linkEscrowAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimKey", type: "address" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimKey", type: "address" },
      { name: "recipient", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "claimKey", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transfers",
    stateMutability: "view",
    inputs: [{ name: "claimKey", type: "address" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "settled", type: "bool" },
    ],
  },
] as const;

/** Sender side: make a fresh one-time key. Pass `claimKey` to deposit(). */
export function createLinkKey(): { linkSecret: Hex; claimKey: Address } {
  const linkSecret = generatePrivateKey();
  return { linkSecret, claimKey: privateKeyToAccount(linkSecret).address };
}

/** Sender side: the URL to share once the deposit has confirmed. */
export function buildLink(appUrl: string, linkSecret: Hex): string {
  return `${appUrl}/claim#${linkSecret}`;
}

/** Recipient side: read the one-time key back out of the page URL. */
export function readLinkSecret(hash: string = window.location.hash): Hex {
  const secret = hash.replace(/^#/, "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error("This link is not valid.");
  return secret as Hex;
}

/**
 * Recipient side: sign "pay this transfer to `recipient`" with the one-time key.
 * Send the result to claim(claimKey, recipient, signature), from any account,
 * including a relayer that pays the gas.
 */
export async function signClaim(params: {
  linkSecret: Hex;
  recipient: Address;
  escrowAddress: Address;
  chainId: number;
}): Promise<{ claimKey: Address; signature: Hex }> {
  const account = privateKeyToAccount(params.linkSecret);
  // Must match rawClaimHash() in LinkEscrow.sol.
  const rawHash = keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "address" }],
      [BigInt(params.chainId), params.escrowAddress, account.address, params.recipient],
    ),
  );
  const signature = await account.signMessage({ message: { raw: rawHash } });
  return { claimKey: account.address, signature };
}
