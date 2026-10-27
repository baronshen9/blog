"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { renderMarkdown } from "@/lib";
import { DomainError } from "@/server/errors";
import {
  createDraft,
  languages,
  trashPost,
  updatePost,
  type PostStatus,
} from "@/server/posts";
import { requireOwner } from "@/app/admin/session";

const editorFields = z.object({
  id: z.uuid().optional(),
  language: z.enum(languages),
  title: z.string(),
  // Sent only while the post's slug can still change.
  slug: z.string().optional(),
  bodyMarkdown: z.string(),
  intent: z.enum(["save", "publish", "unpublish", "preview", "trash"]),
});

export type EditorValues = Omit<z.infer<typeof editorFields>, "intent">;

// `preview` holds the rendered body; `notice` reports a completed save.
export type EditorState = { preview?: string; error?: string; notice?: string };

// What each save button does to an existing post's status, and the notice
// it shows for the resulting status.
const statusChanges = {
  save: undefined,
  publish: "published",
  unpublish: "draft",
} as const;
const notices = {
  save: (status: PostStatus) =>
    status === "draft" ? "Draft saved." : "Saved and updated on the site.",
  publish: () => "Published.",
  unpublish: () => "Unpublished; the post is a draft again.",
};

// Previews the body, or saves the post: a new one as a draft, then opened in
// its editor; an existing one keeps its language, and publishing or
// unpublishing also changes its status, and a slug, when sent, changes it.
// Trashing an existing post discards
// unsaved changes and returns to the post list.
export async function editPostAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  await requireOwner();
  const input = editorFields.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "The form is invalid; reload the page." };
  const { intent, id, language, title, slug, bodyMarkdown } = input.data;

  if (intent === "preview") {
    return { preview: await renderMarkdown(bodyMarkdown) };
  }
  let next: string;
  try {
    if (!id) {
      const created = await createDraft({ language, title, bodyMarkdown });
      next = `/admin/posts/${created.id}`;
    } else if (intent === "trash") {
      await trashPost(id);
      next = "/admin";
    } else {
      const post = await updatePost(id, {
        title,
        slug,
        bodyMarkdown,
        status: statusChanges[intent],
      });
      // The page shows the status, the public link, and the matching buttons.
      refresh();
      return { notice: notices[intent](post.status) };
    }
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  redirect(next);
}
