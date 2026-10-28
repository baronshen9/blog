"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { messages } from "@/messages";
import {
  commentLimits,
  CommentRefused,
  submitComment,
} from "@/server/comments";
import { languages } from "@/server/posts";
import type { CommentFormState } from "@/ui";

const target = z.object({ language: z.enum(languages), slug: z.string() });
const fields = z.object({
  nickname: z.string(),
  message: z.string(),
  website: z.string(),
});

// Open to everyone by design: readers comment without an account. The post
// is bound by the page, whose language is the post's; the service accepts only
// published posts and gives the reason of a refusal, said in that language.
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
  if (!postInput.success) {
    return { error: messages.en.comments.invalidForm };
  }
  const text = messages[postInput.data.language].comments;
  if (!input.success) return { error: text.invalidForm };
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
    if (error instanceof CommentRefused) {
      const reason = text.refusals[error.reason](commentLimits);
      return { error: reason, nickname, message };
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
