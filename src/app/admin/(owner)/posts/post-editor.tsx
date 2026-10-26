"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { PostStatus } from "@/server/posts";
import { Button, Field, Prose } from "@/ui";
import { editPostAction, type EditorState, type EditorValues } from "./actions";

const languageNames = { en: "English", zh: "中文" } as const;

// `status` is the saved status of an existing post; a new post has none.
export function PostEditor({
  initial,
  status,
}: {
  initial: EditorValues;
  status?: PostStatus;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(
    editPostAction,
    {},
  );

  // Submitted here rather than through the form's action prop, so React does
  // not reset the fields afterwards: the chosen language and anything typed
  // while the action runs stay as they are.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { submitter } = event.nativeEvent as SubmitEvent;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => action(form));
  }

  // Saving a new post opens it in a new editor, which would drop anything
  // typed meanwhile, so its fields are read-only until the save ends.
  const creating = pending && !initial.id;
  return (
    <form onSubmit={submit}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <Field label="Title">
        <input name="title" defaultValue={initial.title} readOnly={creating} />
      </Field>
      {initial.id ? (
        <p>
          Language: {languageNames[initial.language]}
          <input type="hidden" name="language" value={initial.language} />
        </p>
      ) : (
        <Field label="Language">
          <select
            name="language"
            defaultValue={initial.language}
            disabled={creating}
          >
            <option value="en">{languageNames.en}</option>
            <option value="zh">{languageNames.zh}</option>
          </select>
        </Field>
      )}
      <Field label="Body (Markdown)">
        <textarea
          name="bodyMarkdown"
          defaultValue={initial.bodyMarkdown}
          readOnly={creating}
          rows={20}
        />
      </Field>
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
      <Button type="submit" name="intent" value="save" disabled={pending}>
        {status === "published" ? "Save" : "Save draft"}
      </Button>{" "}
      {status && (
        <>
          <Button
            type="submit"
            variant={status === "draft" ? "primary" : "secondary"}
            name="intent"
            value={status === "draft" ? "publish" : "unpublish"}
            disabled={pending}
          >
            {status === "draft" ? "Publish" : "Unpublish"}
          </Button>{" "}
        </>
      )}
      <Button type="submit" name="intent" value="preview" disabled={pending}>
        Preview
      </Button>
      {state.preview !== undefined && (
        <section aria-label="Preview">
          <h2>Preview</h2>
          <Prose html={state.preview} />
        </section>
      )}
    </form>
  );
}
