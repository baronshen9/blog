"use client";

import {
  startTransition,
  useActionState,
  type FormEvent,
  type MouseEvent,
} from "react";
import type { PostStatus } from "@/server/posts";
import {
  Button,
  EditorLayout,
  Notice,
  Prose,
  StatusBadge,
  TagField,
} from "@/ui";
import { editPostAction, type EditorState, type EditorValues } from "./actions";

const languageNames = { en: "English", zh: "中文" } as const;

// `post` is the saved state of an existing post, as of `savedAt`; a new post
// has none. The slug can be edited until the post's first publication.
export function PostEditor({
  initial,
  post,
}: {
  initial: EditorValues;
  post?: {
    status: PostStatus;
    path: string;
    slugFixed: boolean;
    savedAt: string;
  };
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

  // A plain button rather than a submit button, so pressing Enter in a field
  // never trashes the post.
  function trash(event: MouseEvent<HTMLButtonElement>) {
    const form = new FormData(event.currentTarget.form ?? undefined);
    form.set("intent", "trash");
    startTransition(() => action(form));
  }

  // Saving a new post opens it in a new editor, which would drop anything
  // typed meanwhile, so its fields are read-only until the save ends.
  const creating = pending && !initial.id;
  const status = post?.status;
  return (
    <form onSubmit={submit}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {/* An existing post keeps its language; a disabled select is not sent. */}
      {initial.id && (
        <input type="hidden" name="language" value={initial.language} />
      )}
      <EditorLayout
        heading={initial.id ? "Edit post" : "New post"}
        title={
          <input
            name="title"
            defaultValue={initial.title}
            placeholder="Title"
            readOnly={creating}
          />
        }
        status={status && <StatusBadge status={status} />}
        language={
          <select
            name="language"
            defaultValue={initial.language}
            disabled={creating || Boolean(initial.id)}
          >
            <option value="en">{languageNames.en}</option>
            <option value="zh">{languageNames.zh}</option>
          </select>
        }
        address={
          post &&
          (post.slugFixed
            ? { path: post.path, live: status === "published" }
            : {
                prefix: `/${initial.language}/posts/`,
                slug: (
                  <input
                    name="slug"
                    defaultValue={initial.slug}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                  />
                ),
              })
        }
        tags={
          <TagField
            // Each save replaces the field with the tags as the server stored
            // them, normalized.
            key={post?.savedAt}
            label="Tags"
            name="tags"
            defaultValue={initial.tags}
            disabled={creating}
          />
        }
        markdown={
          <textarea
            name="bodyMarkdown"
            defaultValue={initial.bodyMarkdown}
            placeholder="Write the post in Markdown."
            readOnly={creating}
            rows={20}
          />
        }
        preview={
          state.preview === undefined ? undefined : (
            <Prose html={state.preview} />
          )
        }
        messages={
          <>
            {state.error && <Notice tone="error">{state.error}</Notice>}
            {state.notice && <Notice tone="success">{state.notice}</Notice>}
          </>
        }
        actions={
          <>
            {status && (
              <Button type="button" onClick={trash} disabled={pending}>
                Move to trash
              </Button>
            )}
            <Button
              type="submit"
              name="intent"
              value="preview"
              disabled={pending}
            >
              Preview
            </Button>
            <Button
              type="submit"
              variant={status === "draft" ? "secondary" : "primary"}
              name="intent"
              value="save"
              disabled={pending}
            >
              {status === "published" ? "Save" : "Save draft"}
            </Button>
            {status && (
              <Button
                type="submit"
                variant={status === "draft" ? "primary" : "secondary"}
                name="intent"
                value={status === "draft" ? "publish" : "unpublish"}
                disabled={pending}
              >
                {status === "draft" ? "Publish" : "Unpublish"}
              </Button>
            )}
          </>
        }
      />
    </form>
  );
}
