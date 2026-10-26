"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/server/auth";
import { getSessionToken } from "./session";
import { sessionCookie } from "./session-cookie";

// Needs no owner check: it only ends the session whose token the caller holds.
export async function signOutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) await signOut(token);
  (await cookies()).delete(sessionCookie);
  redirect("/admin/sign-in");
}
