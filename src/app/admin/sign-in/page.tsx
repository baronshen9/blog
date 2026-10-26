import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <SignInForm />
    </main>
  );
}
