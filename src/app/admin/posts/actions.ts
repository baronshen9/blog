"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { renderMarkdown } from "@/lib";
import { DomainError } from "@/server/errors";
import { createDraft, languages, updatePost } from "@/server/posts";
import { requireOwner } from "@/app/admin/session";

const editorFields = z.object({
  id: z.uuid().optional(),
  language: z.enum(languages),
  title: z.string(),
  bodyMarkdown: z.string(),
  intent: z.enum(["save", "preview"]),
});

export type EditorValues = Omit<z.infer<typeof editorFields>, "intent">;

// `preview` holds the rendered body.
export type EditorState = { preview?: string; error?: string; saved?: boolean };

// Previews the body, or saves the post: a new one as a draft, then opened in
// its editor; an existing one keeps its language and status.
export async function editPostAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  await requireOwner();
  const input = editorFields.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "The form is invalid; reload the page." };
  const { intent, id, language, title, bodyMarkdown } = input.data;

  if (intent === "preview") {
    return { preview: await renderMarkdown(bodyMarkdown) };
  }
  let created;
  try {
    if (id) {
      await updatePost(id, { title, bodyMarkdown });
      return { saved: true };
    }
    created = await createDraft({ language, title, bodyMarkdown });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  redirect(`/admin/posts/${created.id}`);
}
