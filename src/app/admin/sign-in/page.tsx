import type { Metadata } from "next";
import { connection } from "next/server";
import { getConfig } from "@/server/config";
import { SignInFrame } from "@/ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

// Rendered per request, so the build needs no runtime configuration.
export default async function SignInPage() {
  await connection();
  return (
    <SignInFrame siteName={getConfig().SITE_NAME} title="Sign in">
      <SignInForm />
    </SignInFrame>
  );
}
