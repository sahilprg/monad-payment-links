import { createPublicClient, formatUnits, type Address } from "viem";
import { transport } from "./transport";
import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
export const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as Address;
export const USD = process.env.NEXT_PUBLIC_USD_ADDRESS as Address;
export const USD_DECIMALS = 6;

/** Example exchange rate for display only. Update before the demo. */
export const INR_PER_USD = 88;
/** How long a paperplane can be collected before the sender can take it back. */
export const LINK_DAYS = 7;

/** Current time in whole seconds, as the contract counts it. */
export function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export const publicClient = createPublicClient({ chain, transport });

export function formatUsd(amount: bigint): string {
  const n = Number(formatUnits(amount, USD_DECIMALS));
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatInr(amount: bigint): string {
  const n = Number(formatUnits(amount, USD_DECIMALS)) * INR_PER_USD;
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export const escrowAbi = [
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

export const usdAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
