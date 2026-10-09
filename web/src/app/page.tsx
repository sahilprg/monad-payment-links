"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const account = wallets.find((w) => w.walletClientType === "privy");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">Paperplane</span>
        {ready && authenticated && (
          <button onClick={logout} className="text-sm text-ink-soft underline underline-offset-4">
            Sign out
          </button>
        )}
      </header>

      {/* The letter: an airmail-striped edge around a white sheet. */}
      <section className="airmail mt-8 rounded-xl p-2 shadow-[0_10px_30px_-18px_rgba(20,33,61,0.45)]">
        <div className="rounded-md bg-sheet px-6 py-8">
          {!ready ? (
            <p className="text-ink-soft">Loading…</p>
          ) : !authenticated ? (
            <>
              <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight">
                Money from home, sent like a message.
              </h1>
              <p className="mt-4 leading-relaxed text-ink-soft">
                Send this month&apos;s rent or pocket money to your child studying abroad. You
                share a link, they open it, and the money is theirs.
              </p>
              <p className="mt-6 font-hand text-2xl leading-snug text-air-blue">
                For this month&apos;s rent. Eat properly! Love, Amma
              </p>
              <button
                onClick={login}
                className="mt-8 w-full rounded-lg bg-air-blue px-5 py-3.5 text-base font-semibold text-white active:translate-y-px"
              >
                Continue with email
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">You&apos;re signed in</h1>
              <p className="mt-2 break-all text-ink-soft">{user?.email?.address}</p>
              <p className="mt-6 leading-relaxed">
                {account ? "Your account is ready." : "Setting up your account…"}
              </p>
            </>
          )}
        </div>
      </section>

      <p className="mt-auto pt-10 text-center text-sm text-ink-soft">
        Test version. No real money moves.
      </p>
    </main>
  );
}
