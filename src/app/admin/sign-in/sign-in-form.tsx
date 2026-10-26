"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/ui";
import { signInAction, type SignInState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signInAction,
    {},
  );
  return (
    <form action={action}>
      <Field label="Username">
        <input
          name="username"
          autoComplete="username"
          defaultValue={state.username}
          required
        />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="primary" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
