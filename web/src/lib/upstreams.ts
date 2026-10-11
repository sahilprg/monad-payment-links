/** Monad testnet endpoints the server can talk to. */
export const UPSTREAMS: string[] = process.env.NEXT_PUBLIC_RPC_URL
  ? [process.env.NEXT_PUBLIC_RPC_URL]
  : [
      "https://testnet-rpc.monad.xyz",
      "https://rpc-testnet.monadinfra.com",
      "https://rpc.ankr.com/monad_testnet",
    ];
