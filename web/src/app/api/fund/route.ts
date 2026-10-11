// Gets a signed-in account ready to send: a little fee money, and (on request)
// test dollars. On a real launch the test dollars become a rupee top-up.

import { NextResponse } from "next/server";
import { isAddress, parseEther, parseUnits } from "viem";
import { publicClient, USD, USD_DECIMALS, usdAbi } from "@/lib/config";
import { getRelayer, sleep } from "@/lib/relayer";

const FEE_FLOOR = parseEther("0.05");
const FEE_TOPUP = parseEther("0.2");
const TEST_MONEY = parseUnits("100", USD_DECIMALS);
const TEST_MONEY_CAP = parseUnits("1000", USD_DECIMALS);

export async function POST(request: Request) {
  try {
    const { address, addMoney } = await request.json();
    if (typeof address !== "string" || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid account." }, { status: 400 });
    }
    const relayer = getRelayer();

    if ((await publicClient.getBalance({ address })) < FEE_FLOOR) {
      // Retry once: the network can reject two transfers sent back to back.
      for (let attempt = 0; attempt < 2; attempt++) {
        const hash = await relayer.sendTransaction({ to: address, value: FEE_TOPUP });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") break;
        if (attempt === 1) throw new Error("Could not set up the account.");
        await sleep(2500);
      }
    }

    if (addMoney) {
      const balance = await publicClient.readContract({
        address: USD,
        abi: usdAbi,
        functionName: "balanceOf",
        args: [address],
      });
      if (balance >= TEST_MONEY_CAP) {
        return NextResponse.json({ error: "You already have plenty of test money." }, { status: 400 });
      }
      const hash = await relayer.writeContract({
        address: USD,
        abi: usdAbi,
        functionName: "mint",
        args: [address, TEST_MONEY],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Could not add test money.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("fund failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
