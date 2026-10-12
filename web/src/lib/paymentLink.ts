// A paperplane link carries a one-time key plus the personal note. Everything
// sits after the "#", which browsers never send to a server.
//
// An addressed paperplane also carries a random salt. Onchain there is only a
// hash of (email, salt), so the email itself is never published.

import { encodeAbiParameters, keccak256, toHex, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Letter = {
  secret: Hex;
  note: string;
  from: string;
  to: string;
  /** Present only for addressed paperplanes. */
  salt?: Hex;
  /** A masked version of the recipient's email, for display only. */
  hint?: string;
};

/** Sender side: make a fresh one-time key. Pass `claimKey` to deposit(). */
export function createLinkKey(): { secret: Hex; claimKey: Address } {
  const secret = generatePrivateKey();
  return { secret, claimKey: privateKeyToAccount(secret).address };
}

export function claimKeyOf(secret: Hex): Address {
  return privateKeyToAccount(secret).address;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A fresh random salt for an addressed paperplane. */
export function newSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** The value stored onchain for an addressed paperplane. Used by both sides. */
export function lockFor(email: string, salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [normaliseEmail(email), salt]));
}

/** "ananya.k@gmail.com" becomes "an•••@gmail.com". */
export function maskEmail(email: string): string {
  const [name, domain] = normaliseEmail(email).split("@");
  return `${name.slice(0, 2)}•••@${domain}`;
}

/** Sender side: the URL to share once the money is locked in. */
export function buildLink(origin: string, letter: Letter): string {
  const params = new URLSearchParams({ k: letter.secret });
  if (letter.note) params.set("n", letter.note);
  if (letter.from) params.set("f", letter.from);
  if (letter.to) params.set("t", letter.to);
  if (letter.salt) params.set("s", letter.salt);
  if (letter.hint) params.set("h", letter.hint);
  return `${origin}/claim#${params.toString()}`;
}

/** Recipient side: read the letter back out of the page URL. Null if invalid. */
export function readLink(hash: string): Letter | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const secret = params.get("k") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) return null;
  const salt = params.get("s") ?? "";
  return {
    secret: secret as Hex,
    note: (params.get("n") ?? "").slice(0, 280),
    from: (params.get("f") ?? "").slice(0, 40),
    to: (params.get("t") ?? "").slice(0, 40),
    salt: /^0x[0-9a-fA-F]{64}$/.test(salt) ? (salt as Hex) : undefined,
    hint: (params.get("h") ?? "").slice(0, 80) || undefined,
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
