"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import type { Language, PostStatus, Translation } from "@/server/posts";
import {
  Button,
  EditorLayout,
  ImageUpload,
  LanguageLabel,
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
const translationNames = { en: "English", zh: "Chinese" } as const;

// `post` is the saved state of an existing post, as of `savedAt`; a new post
// has none. The slug can be edited until the post's first publication.
// `images` are the media service's upload rules for the upload control.
// `translation` is the post's other language version (for a new translation,
// the post it translates), or, as `{ missing }`, the language an existing
// post without one can be translated into.
export function PostEditor({
  initial,
  post,
  images,
  translation,
}: {
  initial: EditorValues;
  images: { accept: string[]; maxBytes: number };
  translation?: Translation | { missing: Language };
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
  // While an image uploads, its Markdown is not in the body yet, so the post
  // cannot be saved, previewed, or trashed until the upload ends.
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;

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
    const form = new FormData(textarea.form ?? undefined);
    form.set("intent", "preview");
    startTransition(() => action(form));
  }

  // Saving a new post opens it in a new editor, which would drop anything
  // typed meanwhile, so its fields are read-only until the save ends.
  const creating = pending && !initial.id;
  const status = post?.status;
  // An existing post keeps its language, and a translation takes the other
  // language of the post it translates.
  const languageFixed = Boolean(initial.id ?? initial.translationOf);
  return (
    <form onSubmit={submit}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.translationOf && (
        <input
          type="hidden"
          name="translationOf"
          value={initial.translationOf}
        />
      )}
      {/* A disabled select is not sent. */}
      {languageFixed && (
        <input type="hidden" name="language" value={initial.language} />
      )}
      <EditorLayout
        heading={
          initial.id
            ? "Edit post"
            : initial.translationOf
              ? "New translation"
              : "New post"
        }
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
            disabled={creating || languageFixed}
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
        translation={
          translation &&
          ("missing" in translation ? (
            <Link href={`/admin/posts/new?translationOf=${initial.id}`}>
              Add {translationNames[translation.missing]} translation
            </Link>
          ) : (
            <>
              <span>Translation</span>
              <LanguageLabel language={translation.language} />
              <Link
                href={
                  translation.trashed
                    ? "/admin/trash"
                    : `/admin/posts/${translation.id}`
                }
              >
                {translation.title}
              </Link>
              {translation.trashed ? (
                "in the trash"
              ) : (
                <StatusBadge status={translation.status} />
              )}
            </>
          ))
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
            onUploadingChange={setUploading}
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
              <Button type="button" onClick={trash} disabled={busy}>
                Move to trash
              </Button>
            )}
            <Button type="submit" name="intent" value="preview" disabled={busy}>
              Preview
            </Button>
            <Button
              type="submit"
              variant={status === "draft" ? "secondary" : "primary"}
              name="intent"
              value="save"
              disabled={busy}
            >
              {status === "published" ? "Save" : "Save draft"}
            </Button>
            {status && (
              <Button
                type="submit"
                variant={status === "draft" ? "primary" : "secondary"}
                name="intent"
                value={status === "draft" ? "publish" : "unpublish"}
                disabled={busy}
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
