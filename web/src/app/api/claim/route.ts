// Delivers a paperplane. The helper wallet pays the fee; the money can only go
// to the account that the link's one-time key signed for. For an addressed
// paperplane, this server also checks that the person collecting signed in
// with the email the sender chose, and only then adds its approval.

import { NextResponse } from "next/server";
import { isAddress, isHex, type Hex } from "viem";
import { ESCROW, escrowAbi, NO_LOCK, publicClient } from "@/lib/config";
import { lockFor } from "@/lib/paymentLink";
import { whoIsSignedIn } from "@/lib/privyServer";
import { getRelayer } from "@/lib/relayer";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  try {
    const { claimKey, recipient, signature, salt, accessToken } = await request.json();
    if (
      typeof claimKey !== "string" ||
      typeof recipient !== "string" ||
      !isAddress(claimKey) ||
      !isAddress(recipient) ||
      !isHex(signature) ||
      signature.length !== 132
    ) {
      return fail("This link is not valid.", 400);
    }
    const relayer = getRelayer();

    const transfer = await publicClient.readContract({
      address: ESCROW,
      abi: escrowAbi,
      functionName: "transfers",
      args: [claimKey],
    });
    const lock = transfer[5];

    let gateSignature: Hex = "0x";
    if (lock !== NO_LOCK) {
      if (typeof accessToken !== "string" || !accessToken) return fail("Please sign in to collect.", 401);
      if (typeof salt !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(salt)) return fail("This link is not valid.", 400);

      let who: { emails: string[]; accounts: string[] };
      try {
        who = await whoIsSignedIn(accessToken);
      } catch {
        return fail("Your sign-in has expired. Please sign in again.", 401);
      }
      if (!who.accounts.includes(recipient.toLowerCase())) return fail("This account isn't yours.", 403);
      const match = who.emails.some((email) => lockFor(email, salt as Hex) === lock);
      if (!match) {
        return NextResponse.json({ error: "wrong-person" }, { status: 403 });
      }

      const rawGateHash = await publicClient.readContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "rawGateHash",
        args: [claimKey, recipient],
      });
      gateSignature = await relayer.signMessage({ message: { raw: rawGateHash } });
    }

    // Dry run first, so a bad or used link fails here instead of costing a fee.
    try {
      await publicClient.simulateContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "claim",
        args: [claimKey, recipient, signature, gateSignature],
        account: relayer.account,
      });
    } catch {
      return fail("This paperplane can't be collected. It may already be collected, taken back or expired.", 409);
    }

    const hash = await relayer.writeContract({
      address: ESCROW,
      abi: escrowAbi,
      functionName: "claim",
      args: [claimKey, recipient, signature, gateSignature],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("claim reverted");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("claim failed:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
