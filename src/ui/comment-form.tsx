"use client";

import { useActionState } from "react";
import { messages, type Locale } from "@/messages";
import { Button } from "./button";
import { Field } from "./field";
import { Notice } from "./notice";
import styles from "./comment-form.module.css";

// The outcome of a submission. After a refusal, the reader's nickname and
// message come back so the form can keep them after React resets it.
export type CommentFormState = {
  sent?: boolean;
  error?: string;
  nickname?: string;
  message?: string;
};

// A reader's comment on a post: a nickname and a message, sent to `submit`.
// The `website` field is hidden from people; automated senders fill it, and
// the server refuses what they send.
export function CommentForm({
  submit,
  nicknameMaxLength,
  messageMaxLength,
  locale,
}: {
  submit: (
    previous: CommentFormState,
    form: FormData,
  ) => Promise<CommentFormState>;
  nicknameMaxLength: number;
  messageMaxLength: number;
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(submit, {});
  const text = messages[locale].comments;
  return (
    <section className={styles.comments} aria-labelledby="comment-form-title">
      <h2 id="comment-form-title" className={styles.title}>
        {text.title}
      </h2>
      <p className={styles.note}>{text.note}</p>
      <form action={action} className={styles.form}>
        <Field label={text.nickname}>
          <input
            name="nickname"
            defaultValue={state.nickname}
            maxLength={nicknameMaxLength}
            autoComplete="nickname"
            required
          />
        </Field>
        <Field label={text.message}>
          <textarea
            name="message"
            className={styles.message}
            defaultValue={state.message}
            maxLength={messageMaxLength}
            rows={5}
            required
          />
        </Field>
        <div className={styles.trap} aria-hidden="true">
          <label>
            {text.trap}
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className={styles.actions}>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.sent && <Notice tone="success">{text.sent}</Notice>}
          <Button type="submit" variant="primary" disabled={pending}>
            {text.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
