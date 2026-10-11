"use client";

import { usePrivy } from "@privy-io/react-auth";
import { SendDesk } from "@/components/SendDesk";
import { Letter, PrimaryButton, Shell } from "@/components/Shell";

export default function Home() {
  const { ready, authenticated, login } = usePrivy();

  return (
    <Shell>
      {!ready ? (
        <Letter>
          <p className="text-ink-soft">Loading…</p>
        </Letter>
      ) : !authenticated ? (
        <Letter>
          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight">
            Money from home, sent like a message.
          </h1>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Send this month&apos;s rent or pocket money to your child studying abroad. You share a
            link, they open it, and the money is theirs.
          </p>
          <p className="mt-6 font-hand text-2xl leading-snug text-air-blue">
            For this month&apos;s rent. Eat properly! Love, Amma
          </p>
          <PrimaryButton onClick={login} className="mt-8">
            Continue with email
          </PrimaryButton>
        </Letter>
      ) : (
        <SendDesk />
      )}
    </Shell>
  );
}
