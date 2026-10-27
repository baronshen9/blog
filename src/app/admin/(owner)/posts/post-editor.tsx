"use client";

import {
  startTransition,
  useActionState,
  useRef,
  type FormEvent,
  type MouseEvent,
} from "react";
import type { PostStatus } from "@/server/posts";
import {
  Button,
  EditorLayout,
  ImageUpload,
  Notice,
  Prose,
  StatusBadge,
  TagField,
} from "@/ui";
import {
  editPostAction,
  uploadImageAction,
  type EditorState,
  type EditorValues,
} from "./actions";

const languageNames = { en: "English", zh: "中文" } as const;

// `post` is the saved state of an existing post, as of `savedAt`; a new post
// has none. The slug can be edited until the post's first publication.
// `images` are the media service's upload rules for the upload control.
export function PostEditor({
  initial,
  post,
  images,
}: {
  initial: EditorValues;
  images: { accept: string[]; maxBytes: number };
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
  const body = useRef<HTMLTextAreaElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);

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

  // Puts an uploaded image's Markdown at the cursor as a paragraph of its
  // own, and previews the body so the owner sees the image.
  function insertImage(markdown: string) {
    const textarea = body.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    // Enough line breaks to leave a blank line between the image and the text
    // around it, given the breaks already there.
    const gap = (breaks: string) => "\n".repeat(Math.max(0, 2 - breaks.length));
    const head = value.slice(0, start);
    const tail = value.slice(end);
    const before = head ? gap(/\n*$/.exec(head)?.[0] ?? "") : "";
    const after = tail ? gap(/^\n*/.exec(tail)?.[0] ?? "") : "\n";
    textarea.setRangeText(`${before}${markdown}${after}`, start, end, "end");
    textarea.focus();
    textarea.form?.requestSubmit(previewButton.current);
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
            // them, normalized, so the field is read-only until it ends.
            key={post?.savedAt}
            label="Tags"
            name="tags"
            defaultValue={initial.tags}
            disabled={pending}
          />
        }
        tools={
          <ImageUpload
            accept={images.accept}
            maxBytes={images.maxBytes}
            upload={uploadImageAction}
            onUploaded={insertImage}
            disabled={pending}
          />
        }
        markdown={
          <textarea
            ref={body}
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
              ref={previewButton}
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
