// Server only. Checks who is signed in, using Privy's records.

import { PrivyClient } from "@privy-io/node";
import { normalisePhone, type Contact } from "./paymentLink";

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

/** The signed-in person's verified emails and phones, and their Paperplane accounts. */
export async function whoIsSignedIn(accessToken: string): Promise<{ contacts: Contact[]; accounts: string[] }> {
  const { user_id } = await privy().utils().auth().verifyAccessToken(accessToken);
  const user = await privy().users()._get(user_id);
  const contacts: Contact[] = [];
  const accounts: string[] = [];
  for (const account of user.linked_accounts) {
    if (account.type === "email") contacts.push({ kind: "email", id: `email:${account.address.trim().toLowerCase()}` });
    if (account.type === "phone") {
      const phone = normalisePhone(account.phoneNumber ?? account.number ?? "");
      if (phone) contacts.push({ kind: "phone", id: `phone:${phone}` });
    }
    if (account.type === "wallet" && "address" in account) accounts.push(account.address.toLowerCase());
  }
  return { contacts, accounts };
}
