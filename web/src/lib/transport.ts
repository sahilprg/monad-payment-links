import { fallback, http } from "viem";
import { UPSTREAMS } from "./upstreams";

// In the browser, every network request goes through this app's own server
// (/api/rpc), so it works on any connection. The server talks to several
// Monad endpoints and uses whichever answers.
export const transport =
  typeof window === "undefined"
    ? fallback(
        UPSTREAMS.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
        { retryCount: 2 },
      )
    : http("/api/rpc", { timeout: 20_000, retryCount: 2 });
