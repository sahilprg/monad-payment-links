"use client";

import { useCallback, useEffect, useState } from "react";
import { maxUint256, parseUnits, type Address } from "viem";
import {
  ESCROW,
  escrowAbi,
  formatInr,
  formatUsd,
  LINK_DAYS,
  nowSeconds,
  publicClient,
  USD,
  USD_DECIMALS,
  usdAbi,
} from "@/lib/config";
import { buildLink, createLinkKey } from "@/lib/paymentLink";
import { useAccount, walletClientFor } from "@/lib/wallet";
import { ErrorNote, Letter, PrimaryButton } from "./Shell";
import { rememberSent, SentList } from "./SentList";

const field =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base text-ink placeholder:text-ink-soft/60";

type Sent = { link: string; amount: bigint; to: string };

export function SendDesk() {
  const account = useAccount();
  const address = account?.address as Address | undefined;

  const [balance, setBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "money" | "send">("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [copied, setCopied] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  const refreshBalance = useCallback(async (who: Address) => {
    const value = await publicClient.readContract({
      address: USD,
      abi: usdAbi,
      functionName: "balanceOf",
      args: [who],
    });
    setBalance(value);
  }, []);

  // First visit: quietly get the account ready, then show what it holds.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/fund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        if (!cancelled) await refreshBalance(address);
      } catch {
        if (!cancelled) setError("We couldn't load your account. Check your connection and refresh.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, refreshBalance]);

  async function addTestMoney() {
    if (!address) return;
    setError("");
    setBusy("money");
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, addMoney: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshBalance(address);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't add test money. Try again.");
    } finally {
      setBusy("");
    }
  }

  let parsed: bigint | null = null;
  try {
    parsed = amount.trim() ? parseUnits(amount.trim(), USD_DECIMALS) : null;
  } catch {
    parsed = null;
  }

  async function send() {
    if (!account || !address) return;
    setError("");
    if (!parsed || parsed <= BigInt(0)) return setError("Enter an amount in dollars, like 50.");
    if (balance !== null && parsed > balance) {
      return setError(`You have ${formatUsd(balance)}. Add money or send a smaller amount.`);
    }
    setBusy("send");
    try {
      const wallet = await walletClientFor(account);
      const allowance = await publicClient.readContract({
        address: USD,
        abi: usdAbi,
        functionName: "allowance",
        args: [address, ESCROW],
      });
      if (allowance < parsed) {
        const hash = await wallet.writeContract({
          address: USD,
          abi: usdAbi,
          functionName: "approve",
          args: [ESCROW, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const { secret, claimKey } = createLinkKey();
      const expiry = nowSeconds() + BigInt(LINK_DAYS * 24 * 60 * 60);
      const hash = await wallet.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "deposit",
        args: [USD, parsed, claimKey, expiry],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("deposit failed");

      const link = buildLink(window.location.origin, {
        secret,
        note: note.trim(),
        from: from.trim(),
        to: to.trim(),
      });
      rememberSent({ claimKey, link, amount: parsed.toString(), to: to.trim() });
      setListVersion((v) => v + 1);
      setSent({ link, amount: parsed, to: to.trim() });
      setAmount("");
      setNote("");
      await refreshBalance(address);
    } catch (e) {
      console.error(e);
      setError("The paperplane didn't go out. Nothing was taken from you. Please try again.");
    } finally {
      setBusy("");
    }
  }

  if (!account) {
    return (
      <Letter>
        <p className="text-ink-soft">Setting up your account…</p>
      </Letter>
    );
  }

  if (sent) {
    const message = `${sent.to ? sent.to + ", " : ""}I've sent you ${formatUsd(sent.amount)} on Paperplane. Open this to collect it: ${sent.link}`;
    return (
      <>
        <Letter>
          <h1 className="text-2xl font-bold tracking-tight">Your paperplane is ready</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            {formatUsd(sent.amount)} is waiting for {sent.to || "them"}. Share the link and they can
            collect it. You can take it back any time before it&apos;s collected.
          </p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block w-full rounded-lg bg-air-blue px-5 py-3.5 text-center text-base font-semibold text-white"
          >
            Share on WhatsApp
          </a>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(sent.link);
              setCopied(true);
            }}
            className="mt-3 w-full rounded-lg border border-line px-5 py-3.5 text-base font-semibold"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            onClick={() => {
              setSent(null);
              setCopied(false);
            }}
            className="mt-5 w-full text-sm text-ink-soft underline underline-offset-4"
          >
            Send another
          </button>
        </Letter>
        <SentList account={account} version={listVersion} onChange={() => refreshBalance(address!)} />
      </>
    );
  }

  return (
    <>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">You can send</p>
          <p className="text-3xl font-bold tracking-tight">
            {balance === null ? "…" : formatUsd(balance)}
          </p>
        </div>
        <button
          onClick={addTestMoney}
          disabled={busy !== ""}
          className="rounded-lg border border-line bg-sheet px-3.5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "money" ? "Adding…" : "Add $100 test money"}
        </button>
      </div>

      <Letter>
        <h1 className="text-2xl font-bold tracking-tight">Send a paperplane</h1>

        <label className="mt-6 block text-sm font-medium">
          Amount in dollars
          <input
            className={field}
            inputMode="decimal"
            placeholder="50"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
        {parsed !== null && parsed > BigInt(0) && (
          <p className="mt-1.5 text-sm text-ink-soft">About {formatInr(parsed)} at an example rate</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            To
            <input className={field} placeholder="Ananya" maxLength={40} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            From
            <input className={field} placeholder="Amma" maxLength={40} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Your note
          <textarea
            className={`${field} font-hand text-2xl leading-snug text-air-blue placeholder:font-sans placeholder:text-base`}
            rows={3}
            maxLength={280}
            placeholder="For this month's rent. Eat properly!"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <ErrorNote>{error}</ErrorNote>

        <PrimaryButton onClick={send} disabled={busy !== ""} className="mt-6">
          {busy === "send" ? "Sending…" : "Send paperplane"}
        </PrimaryButton>
      </Letter>

      <SentList account={account} version={listVersion} onChange={() => refreshBalance(address!)} />
    </>
  );
}
