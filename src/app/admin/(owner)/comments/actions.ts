"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  approveComment,
  rejectComment,
  removeComment,
} from "@/server/comments";
import { DomainError } from "@/server/errors";
import { requireOwner } from "@/app/admin/session";

const commentFields = z.object({ id: z.uuid() });

// Approves a pending comment; it then shows under its post.
export async function approveCommentAction(form: FormData): Promise<void> {
  await moderate(form, approveComment);
}

// Rejects a pending comment; it is deleted and never shown.
export async function rejectCommentAction(form: FormData): Promise<void> {
  await moderate(form, rejectComment);
}

// Removes an approved comment from its post for good.
export async function removeCommentAction(form: FormData): Promise<void> {
  await moderate(form, removeComment);
}

// Applies `change` to the comment the form names and refreshes the page,
// including the pending count in the navigation. A comment already
// moderated, for example in another tab, is no error: the refreshed page
// shows where it is now.
async function moderate(
  form: FormData,
  change: (id: string) => Promise<void>,
): Promise<void> {
  await requireOwner();
  const input = commentFields.safeParse(Object.fromEntries(form));
  refresh();
  if (!input.success) return;
  try {
    await change(input.data.id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") return;
    throw error;
  }
}
