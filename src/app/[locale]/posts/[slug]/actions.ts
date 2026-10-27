"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { submitComment } from "@/server/comments";
import { DomainError } from "@/server/errors";
import { languages } from "@/server/posts";
import type { CommentFormState } from "@/ui";

const target = z.object({ language: z.enum(languages), slug: z.string() });
const fields = z.object({
  nickname: z.string(),
  message: z.string(),
  website: z.string(),
});

// Open to everyone by design: readers comment without an account. The post
// is bound by the page; the service accepts only published posts.
export async function submitCommentAction(
  post: { language: string; slug: string },
  _previous: CommentFormState,
  form: FormData,
): Promise<CommentFormState> {
  const input = fields.safeParse({
    nickname: form.get("nickname"),
    message: form.get("message"),
    website: form.get("website"),
  });
  const postInput = target.safeParse(post);
  if (!input.success || !postInput.success) {
    return { error: "The form is invalid; reload the page." };
  }
  const { nickname, message, website } = input.data;
  try {
    await submitComment({
      ...postInput.data,
      nickname,
      message,
      trap: website,
      visitor: await visitorAddress(),
    });
    return { sent: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message, nickname, message };
    }
    throw error;
  }
}

// The address of whoever sent the request: the last X-Forwarded-For entry,
// added by the nearest proxy, or by Next.js from the connection when no proxy
// sent one.
async function visitorAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  return forwarded.split(",").pop()?.trim() ?? "";
}
