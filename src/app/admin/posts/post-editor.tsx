"use client";

import { useActionState } from "react";
import { editPostAction, type EditorState, type EditorValues } from "./actions";

const languageNames = { en: "English", zh: "中文" } as const;

export function PostEditor({ initial }: { initial: EditorValues }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(
    editPostAction,
    { values: initial },
  );
  const { values } = state;
  return (
    <form action={action}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <p>
        <label>
          Title <input name="title" defaultValue={values.title} />
        </label>
      </p>
      <p>
        {values.id ? (
          <>
            Language: {languageNames[values.language]}
            <input type="hidden" name="language" value={values.language} />
          </>
        ) : (
          <label>
            Language{" "}
            <select name="language" defaultValue={values.language}>
              <option value="en">{languageNames.en}</option>
              <option value="zh">{languageNames.zh}</option>
            </select>
          </label>
        )}
      </p>
      <p>
        <label>
          Body (Markdown)
          <br />
          <textarea
            name="bodyMarkdown"
            defaultValue={values.bodyMarkdown}
            rows={20}
            cols={80}
          />
        </label>
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      {state.saved && <p role="status">Draft saved.</p>}
      <button type="submit" name="intent" value="save" disabled={pending}>
        Save draft
      </button>{" "}
      <button type="submit" name="intent" value="preview" disabled={pending}>
        Preview
      </button>
      {state.preview !== undefined && (
        <section aria-label="Preview">
          <h2>Preview</h2>
          {/* Sanitized by the Markdown renderer. */}
          <div dangerouslySetInnerHTML={{ __html: state.preview }} />
        </section>
      )}
    </form>
  );
}
