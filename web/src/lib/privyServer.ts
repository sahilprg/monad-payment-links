// Server only. Checks who is signed in, using Privy's records.

import { PrivyClient } from "@privy-io/node";

let client: PrivyClient | null = null;

function privy(): PrivyClient {
  if (!client) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) throw new Error("PRIVY_APP_SECRET is missing.");
    client = new PrivyClient({ appId, appSecret });
  }
  return client;
}

/** The signed-in person's verified emails and Paperplane account addresses. */
export async function whoIsSignedIn(accessToken: string): Promise<{ emails: string[]; accounts: string[] }> {
  const { user_id } = await privy().utils().auth().verifyAccessToken(accessToken);
  const user = await privy().users()._get(user_id);
  const emails: string[] = [];
  const accounts: string[] = [];
  for (const account of user.linked_accounts) {
    if (account.type === "email") emails.push(account.address.trim().toLowerCase());
    if (account.type === "wallet" && "address" in account) accounts.push(account.address.toLowerCase());
  }
  return { emails, accounts };
}
