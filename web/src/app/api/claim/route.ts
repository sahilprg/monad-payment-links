// Delivers a paperplane. The helper wallet pays the fee; the money can only go
// to the account that the link's one-time key signed for.

import { NextResponse } from "next/server";
import { isAddress, isHex } from "viem";
import { ESCROW, escrowAbi, publicClient } from "@/lib/config";
import { getRelayer } from "@/lib/relayer";

export async function POST(request: Request) {
  try {
    const { claimKey, recipient, signature } = await request.json();
    if (
      typeof claimKey !== "string" ||
      typeof recipient !== "string" ||
      !isAddress(claimKey) ||
      !isAddress(recipient) ||
      !isHex(signature) ||
      signature.length !== 132
    ) {
      return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
    }
    const relayer = getRelayer();

    // Dry run first, so a bad or used link fails here instead of costing a fee.
    try {
      await publicClient.simulateContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "claim",
        args: [claimKey, recipient, signature],
        account: relayer.account,
      });
    } catch {
      return NextResponse.json(
        { error: "This paperplane can't be collected. It may already be collected or expired." },
        { status: 409 },
      );
    }

    const hash = await relayer.writeContract({
      address: ESCROW,
      abi: escrowAbi,
      functionName: "claim",
      args: [claimKey, recipient, signature],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("claim reverted");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("claim failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
