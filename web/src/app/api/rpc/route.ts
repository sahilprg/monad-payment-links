// Passes the browser's network requests on to Monad. Reads go to every
// endpoint at once and the first answer wins; sending a transaction goes to
// one endpoint at a time.

import { NextResponse } from "next/server";
import { UPSTREAMS } from "@/lib/upstreams";

export const maxDuration = 30;

async function ask(url: string, body: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const text = await res.text();
  JSON.parse(text); // only accept a real JSON answer
  return text;
}

const json = (text: string) => new Response(text, { headers: { "Content-Type": "application/json" } });

export async function POST(request: Request) {
  const body = await request.text();
  let calls: unknown[];
  try {
    const parsed = JSON.parse(body);
    calls = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const methods = calls.map((c) => (c as { method?: unknown })?.method);
  if (calls.length === 0 || calls.length > 20 || !methods.every((m) => typeof m === "string" && /^(eth|net)_/.test(m))) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 400 });
  }

  const isSend = methods.includes("eth_sendRawTransaction");
  try {
    if (!isSend) return json(await Promise.any(UPSTREAMS.map((url) => ask(url, body, 8_000))));
    for (const url of UPSTREAMS) {
      try {
        return json(await ask(url, body, 8_000));
      } catch {
        // try the next endpoint
      }
    }
    throw new Error("no endpoint accepted the transaction");
  } catch (error) {
    console.error("rpc proxy failed:", error);
    return NextResponse.json({ error: "The network is busy. Please try again." }, { status: 502 });
  }
}
