import { afterEach, expect, test, vi } from "vitest";
import { commentRateLimit, listCommentsForModeration } from "@/server/comments";
import { createDraft, updatePost } from "@/server/posts";
import { submitCommentAction } from "./actions";

// The request the action reads its visitor address from.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

afterEach(() => {
  vi.useRealTimers();
});

function commentForm(nickname: string, message: string): FormData {
  const form = new FormData();
  form.set("nickname", nickname);
  form.set("message", message);
  form.set("website", "");
  return form;
}

test("refuses a reader over the rate limit and keeps their input", async () => {
  const draft = await createDraft({
    language: "en",
    title: "Busy",
    bodyMarkdown: "",
  });
  const post = await updatePost(draft.id, { status: "published" });
  request.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  // Every submission falls in one rate-limit window.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 12, 0, 0)));
  const submit = (message: string) =>
    submitCommentAction(post, {}, commentForm("Reader", message));

  for (let n = 1; n <= commentRateLimit.count; n++) {
    await expect(submit(`Comment ${n}`)).resolves.toEqual({ sent: true });
  }
  await expect(submit("One too many")).resolves.toEqual({
    error: `You have sent too many comments for now; try again in ${commentRateLimit.windowMinutes} minutes.`,
    nickname: "Reader",
    message: "One too many",
  });

  const stored = await listCommentsForModeration("pending");
  expect(stored).toHaveLength(commentRateLimit.count);
  expect(stored.map(({ message }) => message)).not.toContain("One too many");
});
