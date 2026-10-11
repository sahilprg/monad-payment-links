"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Paperplane
        </Link>
        {ready && authenticated && (
          <button onClick={logout} className="text-sm text-ink-soft underline underline-offset-4">
            Sign out
          </button>
        )}
      </header>
      {children}
      <p className="mt-auto pt-10 text-center text-sm text-ink-soft">
        Test version. No real money moves.
      </p>
    </main>
  );
}

/** The letter: an airmail-striped edge around a white sheet. */
export function Letter({ children }: { children: React.ReactNode }) {
  return (
    <section className="airmail mt-8 rounded-xl p-2 shadow-[0_10px_30px_-18px_rgba(20,33,61,0.45)]">
      <div className="rounded-md bg-sheet px-6 py-8">{children}</div>
    </section>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg bg-air-blue px-5 py-3.5 text-base font-semibold text-white active:translate-y-px disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-4 rounded-md border border-air-red/40 bg-air-red/5 px-3 py-2 text-sm text-air-red">
      {children}
    </p>
  );
}
