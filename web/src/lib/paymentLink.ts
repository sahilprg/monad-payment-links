// A paperplane link carries a one-time key plus the personal note. Everything
// sits after the "#", which browsers never send to a server.
//
// An addressed paperplane also carries a random salt. Onchain there is only a
// hash of (email or phone, salt), so the contact itself is never published.

import { encodeAbiParameters, keccak256, toHex, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Letter = {
  secret: Hex;
  note: string;
  from: string;
  to: string;
  /** Present only for addressed paperplanes. */
  salt?: Hex;
  /** A masked version of the recipient's email or phone, for display only. */
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

export type Contact = { kind: "email" | "phone"; id: string };

/** A phone number as "+<country code><number>". 10-digit numbers are taken as Indian. */
export function normalisePhone(value: string): string | null {
  let v = value.trim().replace(/[\s\-().]/g, "");
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (/^\d{10}$/.test(v)) v = "+91" + v;
  if (/^0\d{10}$/.test(v)) v = "+91" + v.slice(1);
  return /^\+\d{8,15}$/.test(v) ? v : null;
}

/** Reads what the sender typed as an email or a phone number. Null if it is neither. */
export function parseContact(value: string): Contact | null {
  const v = value.trim();
  if (v.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { kind: "email", id: `email:${v.toLowerCase()}` } : null;
  }
  const phone = normalisePhone(v);
  return phone ? { kind: "phone", id: `phone:${phone}` } : null;
}

/** A fresh random salt for an addressed paperplane. */
export function newSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** The value stored onchain for an addressed paperplane. Used by both sides. */
export function lockFor(contact: Contact, salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [contact.id, salt]));
}

/** "ananya.k@gmail.com" becomes "an•••@gmail.com"; "+919876543210" becomes "+91•••210". */
export function maskContact(contact: Contact): string {
  const value = contact.id.slice(contact.id.indexOf(":") + 1);
  if (contact.kind === "phone") return `${value.slice(0, 3)}•••${value.slice(-3)}`;
  const [name, domain] = value.split("@");
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
