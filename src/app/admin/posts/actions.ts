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

// The submitted values come back so the form can keep them after React resets
// it; `preview` holds the rendered body.
export type EditorState = {
  values: EditorValues;
  preview?: string;
  error?: string;
  saved?: boolean;
};

// Previews the body, or saves the post: a new one as a draft, then opened in
// its editor; an existing one keeps its language and status.
export async function editPostAction(
  previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  await requireOwner();
  const input = editorFields.safeParse(Object.fromEntries(form));
  if (!input.success) {
    return { ...previous, error: "The form is invalid; reload the page." };
  }
  const { intent, ...values } = input.data;
  const { id, title, bodyMarkdown } = values;

  if (intent === "preview") {
    return { values, preview: await renderMarkdown(bodyMarkdown) };
  }
  let created;
  try {
    if (id) {
      await updatePost(id, { title, bodyMarkdown });
      return { values, saved: true };
    }
    created = await createDraft(values);
  } catch (error) {
    if (error instanceof DomainError) return { values, error: error.message };
    throw error;
  }
  redirect(`/admin/posts/${created.id}`);
}
