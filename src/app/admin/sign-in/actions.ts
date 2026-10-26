"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { sessionCookie } from "@/app/admin/session-cookie";

// The username comes back so the form can keep it after React resets it.
export type SignInState = { error?: string; username?: string };

const credentials = z.object({ username: z.string(), password: z.string() });

// Open to everyone by design: it is how the owner proves access.
export async function signInAction(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const input = credentials.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Enter a username and a password." };

  let session;
  try {
    session = await signIn(input.data);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message, username: input.data.username };
    }
    throw error;
  }

  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set({
    ...sessionCookie,
    value: session.token,
    expires: session.expiresAt,
    httpOnly: true,
    sameSite: "lax",
    secure: https,
  });
  redirect("/admin");
}
