"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/ui";
import { createTokenAction, type TokenFormState } from "./actions";
import styles from "./tokens.module.css";

// Creates a token and shows its secret once: the secret lives only in this
// form's state, so leaving or reloading the page drops it for good.
export function TokenForm({ nameMaxLength }: { nameMaxLength: number }) {
  const [state, action, pending] = useActionState<TokenFormState, FormData>(
    createTokenAction,
    {},
  );
  return (
    <div className={styles.create}>
      {state.created && (
        <div className={styles.secret}>
          <Notice tone="success">
            Token “{state.created.name}” created. Copy its secret now; it will
            not be shown again.
          </Notice>
          <Field label="Secret">
            <input
              value={state.created.secret}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
        </div>
      )}
      <form action={action}>
        <Field label="Token name">
          <input
            name="name"
            defaultValue={state.name}
            placeholder="Claude Code on my laptop"
            maxLength={nameMaxLength}
            required
          />
        </Field>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" variant="primary" disabled={pending}>
          Create token
        </Button>
      </form>
    </div>
  );
}
