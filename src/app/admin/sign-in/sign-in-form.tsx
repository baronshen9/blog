"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signInAction,
    {},
  );
  return (
    <form action={action}>
      <p>
        <label>
          Username{" "}
          <input
            name="username"
            autoComplete="username"
            defaultValue={state.username}
            required
          />
        </label>
      </p>
      <p>
        <label>
          Password{" "}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>
        Sign in
      </button>
    </form>
  );
}
