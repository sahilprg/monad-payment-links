"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { Address } from "viem";
import { chain, ESCROW, escrowAbi, formatInr, formatUsd, NO_LOCK, nowSeconds, publicClient, USD, usdAbi } from "@/lib/config";
import { claimKeyOf, readLink, signClaim, type Letter as LetterData } from "@/lib/paymentLink";
import { useAccount } from "@/lib/wallet";
import { ErrorNote, Letter, PrimaryButton, Shell } from "@/components/Shell";

type View =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "gone"; reason: "collected" | "expired" }
  | { kind: "ready"; amount: bigint; addressed: boolean }
  | { kind: "done"; amount: bigint; balance: bigint | null };

export default function ClaimPage() {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const account = useAccount();
  const [letter, setLetter] = useState<LetterData | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [wrongPerson, setWrongPerson] = useState(false);
  const [wantsToCollect, setWantsToCollect] = useState(false);

  // Read the letter from the link, then look up the money waiting behind it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parsed = readLink(window.location.hash);
      if (!parsed) {
        if (!cancelled) setView({ kind: "invalid" });
        return;
      }
      try {
        const t = await publicClient.readContract({
          address: ESCROW,
          abi: escrowAbi,
          functionName: "transfers",
          args: [claimKeyOf(parsed.secret)],
        });
        if (cancelled) return;
        setLetter(parsed);
        const [sender, , amount, expiry, settled, lock] = t;
        const addressed = lock !== NO_LOCK;
        if (/^0x0+$/.test(sender) || (addressed && !parsed.salt)) setView({ kind: "invalid" });
        else if (settled) setView({ kind: "gone", reason: "collected" });
        else if (nowSeconds() > expiry) setView({ kind: "gone", reason: "expired" });
        else setView({ kind: "ready", amount, addressed });
      } catch {
        if (!cancelled) setError("We couldn't open this paperplane. Check your connection and refresh.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const collect = useCallback(
    async (recipient: Address, current: LetterData, amount: bigint) => {
      setWantsToCollect(false);
      setError("");
      setWrongPerson(false);
      setCollecting(true);
      try {
        const signed = await signClaim({
          secret: current.secret,
          recipient,
          escrowAddress: ESCROW,
          chainId: chain.id,
        });
        const accessToken = current.salt ? await getAccessToken() : null;
        const res = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...signed, recipient, salt: current.salt, accessToken }),
        });
        if (!res.ok) {
          const message = (await res.json()).error;
          if (message === "wrong-person") {
            setWrongPerson(true);
            return;
          }
          throw new Error(message);
        }
        let balance: bigint | null = null;
        try {
          balance = await publicClient.readContract({
            address: USD,
            abi: usdAbi,
            functionName: "balanceOf",
            args: [recipient],
          });
        } catch {}
        setView({ kind: "done", amount, balance });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
      } finally {
        setCollecting(false);
      }
    },
    [getAccessToken],
  );

  // After signing in from this page, carry on collecting without a second tap.
  useEffect(() => {
    if (!wantsToCollect || !account || !letter || view.kind !== "ready" || collecting) return;
    const recipient = account.address as Address;
    const amount = view.amount;
    (async () => {
      await collect(recipient, letter, amount);
    })();
  }, [wantsToCollect, account, letter, view, collecting, collect]);

  function onCollect() {
    if (!letter || view.kind !== "ready") return;
    if (!authenticated || !account) {
      setWantsToCollect(true);
      if (!authenticated) login();
      return;
    }
    void collect(account.address as Address, letter, view.amount);
  }

  const waitingForAccount = wantsToCollect && authenticated && !account;

  return (
    <Shell>
      <Letter>
        {view.kind === "loading" && !error && <p className="text-ink-soft">Opening your paperplane…</p>}

        {view.kind === "invalid" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">This link doesn&apos;t work</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Part of it may be missing. Ask the sender to share the full link again.
            </p>
          </>
        )}

        {view.kind === "gone" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              {view.reason === "collected" ? "This paperplane is no longer available" : "This paperplane has expired"}
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              {view.reason === "collected"
                ? "It was already collected, or the sender took it back. If that's a surprise, check with the sender."
                : "The sender can take the money back now. Ask them to send a new one."}
            </p>
          </>
        )}

        {(view.kind === "ready" || view.kind === "done") && letter && (
          <>
            <p className="text-ink-soft">
              {letter.to ? `${letter.to}, ` : ""}
              {letter.from ? `${letter.from} sent you` : "you've been sent"}
            </p>
            <p className="mt-1 text-5xl font-bold tracking-tight">{formatUsd(view.amount)}</p>
            <p className="mt-1.5 text-sm text-ink-soft">About {formatInr(view.amount)} at an example rate</p>
            {view.kind === "ready" && view.addressed && letter.hint && (
              <p className="mt-3 inline-block rounded-md bg-paper px-2.5 py-1 text-sm text-ink-soft">
                Only for {letter.hint}
              </p>
            )}

            {letter.note && (
              <p className="mt-6 whitespace-pre-wrap break-words border-l-2 border-air-red/50 pl-4 font-hand text-[1.7rem] leading-snug text-air-blue">
                {letter.note}
              </p>
            )}

            {view.kind === "ready" ? (
              <>
                <ErrorNote>{error}</ErrorNote>
                {wrongPerson && (
                  <div role="alert" className="mt-4 rounded-md border border-air-red/40 bg-air-red/5 px-3 py-3 text-sm">
                    <p className="text-air-red">
                      This paperplane is for {letter.hint ?? "someone else"}, and you&apos;re signed in as{" "}
                      {user?.email?.address ?? "a different email"}.
                    </p>
                    <button
                      onClick={async () => {
                        setWrongPerson(false);
                        await logout();
                      }}
                      className="mt-2 font-semibold underline underline-offset-4"
                    >
                      Sign in with a different email
                    </button>
                  </div>
                )}
                <PrimaryButton onClick={onCollect} disabled={!ready || collecting || waitingForAccount} className="mt-8">
                  {collecting || waitingForAccount ? "Collecting…" : `Collect ${formatUsd(view.amount)}`}
                </PrimaryButton>
                {!authenticated && (
                  <p className="mt-3 text-center text-sm text-ink-soft">
                    {view.addressed && letter.hint
                      ? `Sign in with ${letter.hint} to collect. No app to install.`
                      : "You'll sign in with your email. No app to install."}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-8 rounded-lg bg-paper px-4 py-4">
                <p className="font-semibold">Collected. It&apos;s yours.</p>
                {view.balance !== null && (
                  <p className="mt-1 text-ink-soft">Your Paperplane balance is {formatUsd(view.balance)}.</p>
                )}
                <p className="mt-3 text-sm text-ink-soft">
                  Moving it to your bank account isn&apos;t part of this test version yet.
                </p>
              </div>
            )}
          </>
        )}

        {view.kind === "loading" && <ErrorNote>{error}</ErrorNote>}
      </Letter>
    </Shell>
  );
}
