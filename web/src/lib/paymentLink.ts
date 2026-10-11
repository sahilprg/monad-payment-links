// A paperplane link carries a one-time key plus the personal note. Everything
// sits after the "#", which browsers never send to a server.

import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Letter = { secret: Hex; note: string; from: string; to: string };

/** Sender side: make a fresh one-time key. Pass `claimKey` to deposit(). */
export function createLinkKey(): { secret: Hex; claimKey: Address } {
  const secret = generatePrivateKey();
  return { secret, claimKey: privateKeyToAccount(secret).address };
}

export function claimKeyOf(secret: Hex): Address {
  return privateKeyToAccount(secret).address;
}

/** Sender side: the URL to share once the money is locked in. */
export function buildLink(origin: string, letter: Letter): string {
  const params = new URLSearchParams({ k: letter.secret });
  if (letter.note) params.set("n", letter.note);
  if (letter.from) params.set("f", letter.from);
  if (letter.to) params.set("t", letter.to);
  return `${origin}/claim#${params.toString()}`;
}

/** Recipient side: read the letter back out of the page URL. Null if invalid. */
export function readLink(hash: string): Letter | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const secret = params.get("k") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) return null;
  return {
    secret: secret as Hex,
    note: (params.get("n") ?? "").slice(0, 280),
    from: (params.get("f") ?? "").slice(0, 40),
    to: (params.get("t") ?? "").slice(0, 40),
  };
}

/**
 * Recipient side: sign "pay this to `recipient`" with the one-time key.
 * Must match rawClaimHash() in LinkEscrow.sol.
 */
export async function signClaim(params: {
  secret: Hex;
  recipient: Address;
  escrowAddress: Address;
  chainId: number;
}): Promise<{ claimKey: Address; signature: Hex }> {
  const account = privateKeyToAccount(params.secret);
  const rawHash = keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "address" }],
      [BigInt(params.chainId), params.escrowAddress, account.address, params.recipient],
    ),
  );
  const signature = await account.signMessage({ message: { raw: rawHash } });
  return { claimKey: account.address, signature };
}
