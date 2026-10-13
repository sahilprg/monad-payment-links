"use client";

import { useEffect, useState } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import { ESCROW, escrowAbi, formatTime, formatUsd, nowSeconds, publicClient } from "@/lib/config";
import { walletClientFor } from "@/lib/wallet";

type SentItem = { claimKey: Address; link: string; amount: string; to: string };
type Status = "waiting" | "collected" | "expired" | "returned";

const KEY = "paperplane.sent";

function load(): SentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Remember a sent paperplane on this device so its status can be shown later. */
export function rememberSent(item: SentItem) {
  try {
    localStorage.setItem(KEY, JSON.stringify([item, ...load()].slice(0, 20)));
  } catch {
    // Private browsing or full storage: the list just won't include this one.
  }
}

function markReturned(claimKey: Address) {
  try {
    const returned: string[] = JSON.parse(localStorage.getItem(KEY + ".returned") ?? "[]");
    localStorage.setItem(KEY + ".returned", JSON.stringify([...returned, claimKey]));
  } catch {}
}

type Row = SentItem & { status: Status; opensAt: string };

const label: Record<Status, string> = {
  waiting: "Waiting to be collected",
  collected: "Collected",
  expired: "Not collected in time",
  returned: "Taken back",
};

export function SentList(props: { account: ConnectedWallet; version: number; onChange: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = load().slice(0, 10);
      let returned: string[] = [];
      try {
        returned = JSON.parse(localStorage.getItem(KEY + ".returned") ?? "[]");
      } catch {}
      const now = nowSeconds();
      const withStatus = await Promise.all(
        items.map(async (item) => {
          let status: Status | "unknown" = "waiting";
          let opensAt = "";
          try {
            const t = await publicClient.readContract({
              address: ESCROW,
              abi: escrowAbi,
              functionName: "transfers",
              args: [item.claimKey],
            });
            // Not in this contract (for example sent before an upgrade): hide it.
            if (/^0x0+$/.test(t[0])) status = "unknown";
            else if (t[4]) status = returned.includes(item.claimKey) ? "returned" : "collected";
            else if (now > t[3]) status = "expired";
            if (status === "waiting" && now < t[6]) opensAt = formatTime(t[6]);
          } catch {}
          return { ...item, status, opensAt };
        }),
      );
      if (!cancelled) {
        setRows(withStatus.filter((r): r is Row => r.status !== "unknown"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.version, tick]);

  async function takeBack(claimKey: Address) {
    setBusyKey(claimKey);
    try {
      const wallet = await walletClientFor(props.account);
      const hash = await wallet.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "cancel",
        args: [claimKey],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      markReturned(claimKey);
      props.onChange();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("");
      setTick((t) => t + 1);
    }
  }

  if (rows.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Sent from this device</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-sheet">
        {rows.map((row) => (
          <li key={row.claimKey} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {formatUsd(BigInt(row.amount))}
                {row.to ? ` to ${row.to}` : ""}
              </p>
              <p className={`text-sm ${row.status === "collected" ? "text-air-blue" : "text-ink-soft"}`}>
                {row.opensAt ? `Safety hold until ${row.opensAt}` : label[row.status]}
              </p>
            </div>
            {(row.status === "waiting" || row.status === "expired") && (
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-sm font-semibold">
                {row.status === "waiting" && (
                  <button
                    onClick={() => navigator.clipboard.writeText(row.link)}
                    className="underline underline-offset-4"
                  >
                    Copy link
                  </button>
                )}
                <button
                  onClick={() => takeBack(row.claimKey)}
                  disabled={busyKey !== ""}
                  className="text-air-red underline underline-offset-4 disabled:opacity-50"
                >
                  {busyKey === row.claimKey ? "Taking back…" : "Take it back"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
