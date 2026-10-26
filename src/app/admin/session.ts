import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionOwner, type Owner } from "@/server/auth";
import { sessionCookie } from "./session-cookie";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookie.name)?.value;
}

// The access check of every admin page and Server Action; the proxy's
// redirect is only a shortcut and does not validate the session.
export async function requireOwner(): Promise<Owner> {
  const token = await getSessionToken();
  const owner = token ? await getSessionOwner(token) : null;
  if (!owner) redirect("/admin/sign-in");
  return owner;
}
