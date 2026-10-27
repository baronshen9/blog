"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { deletePostPermanently, restorePost } from "@/server/posts";
import { requireOwner } from "@/app/admin/session";

const trashFields = z.object({ id: z.uuid() });

// Restores a trashed post and opens it in its editor, as a draft.
export async function restorePostAction(form: FormData): Promise<void> {
  const id = await changeTrashedPost(form, restorePost);
  if (id) redirect(`/admin/posts/${id}`);
}

// Deletes a trashed post for good; the trash then lists the rest.
export async function deletePostAction(form: FormData): Promise<void> {
  await changeTrashedPost(form, deletePostPermanently);
}

// Applies `change` to the trashed post the form names and returns its id. A
// post that already left the trash, for example in another tab, is no error:
// the refreshed trash simply no longer lists it.
async function changeTrashedPost(
  form: FormData,
  change: (id: string) => Promise<void>,
): Promise<string | undefined> {
  await requireOwner();
  const input = trashFields.safeParse(Object.fromEntries(form));
  refresh();
  if (!input.success) return undefined;
  try {
    await change(input.data.id);
    return input.data.id;
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return undefined;
    }
    throw error;
  }
}
