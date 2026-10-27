import { afterEach, expect, test, vi } from "vitest";
import { getDb } from "@/server/db";
import {
  createDraft,
  restorePost,
  trashPost,
  updatePost,
} from "@/server/posts";
import {
  approveComment,
  commentRateLimit,
  countPendingComments,
  listCommentsForModeration,
  listPublicComments,
  rejectComment,
  removeComment,
  submitComment,
  type CommentSubmission,
} from ".";

async function publishedPost(title = "Hello") {
  const draft = await createDraft({ language: "en", title, bodyMarkdown: "" });
  return updatePost(draft.id, { status: "published" });
}

function submission(
  post: { language: "en" | "zh"; slug: string },
  overrides: Partial<CommentSubmission> = {},
): CommentSubmission {
  return {
    language: post.language,
    slug: post.slug,
    nickname: "Reader",
    message: "Nice post.",
    trap: "",
    visitor: "203.0.113.7",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

test("stores a trimmed comment on a published post as pending", async () => {
  const post = await publishedPost();

  await submitComment(
    submission(post, { nickname: "  Reader  ", message: "  Nice post.\n" }),
  );

  const comments = await getDb().comment.findMany();
  expect(comments).toEqual([
    expect.objectContaining({
      postId: post.id,
      nickname: "Reader",
      message: "Nice post.",
      status: "pending",
    }),
  ]);
});

test.each([
  ["an empty nickname", { nickname: "  " }, "Enter a nickname."],
  [
    "a long nickname",
    { nickname: "x".repeat(41) },
    "Keep the nickname within 40 characters.",
  ],
  ["an empty message", { message: "\n " }, "Enter a message."],
  [
    "a long message",
    { message: "x".repeat(2001) },
    "Keep the message within 2,000 characters.",
  ],
  [
    "a filled hidden field",
    { trap: "https://spam.example" },
    "This comment looks automated and was not sent.",
  ],
])("refuses %s without storing it", async (_, overrides, message) => {
  const post = await publishedPost();

  await expect(
    submitComment(submission(post, overrides)),
  ).rejects.toMatchObject({ code: "VALIDATION", message });
  expect(await getDb().comment.count()).toBe(0);
  expect(await getDb().commentRateLimit.count()).toBe(0);
});

test("accepts a nickname and a message at their limits", async () => {
  const post = await publishedPost();

  await submitComment(
    submission(post, { nickname: "名".repeat(40), message: "x".repeat(2000) }),
  );

  expect(await getDb().comment.count()).toBe(1);
});

test("refuses comments on drafts, trashed posts, and unknown posts", async () => {
  const draft = await createDraft({
    language: "en",
    title: "Draft",
    bodyMarkdown: "",
  });
  const trashed = await publishedPost("Trashed");
  await trashPost(trashed.id);

  for (const post of [draft, trashed, { language: "en" as const, slug: "x" }]) {
    await expect(submitComment(submission(post))).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This post accepts no comments.",
    });
  }
  expect(await getDb().comment.count()).toBe(0);
});

test("refuses a visitor over the rate limit until the window ends", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 12, 0, 1)));
  const post = await publishedPost();
  for (let i = 0; i < commentRateLimit.count; i++) {
    await submitComment(submission(post));
  }

  await expect(submitComment(submission(post))).rejects.toMatchObject({
    code: "CONFLICT",
    message:
      "You have sent too many comments for now; try again in 10 minutes.",
  });
  expect(await getDb().comment.count()).toBe(commentRateLimit.count);

  await submitComment(submission(post, { visitor: "198.51.100.2" }));
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 12, 10, 0)));
  await submitComment(submission(post));
  expect(await getDb().comment.count()).toBe(commentRateLimit.count + 2);
});

test("counts simultaneous submissions without letting them pass the limit", async () => {
  const post = await publishedPost();

  const results = await Promise.allSettled(
    Array.from({ length: commentRateLimit.count + 3 }, () =>
      submitComment(submission(post)),
    ),
  );

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
    commentRateLimit.count,
  );
  expect(await getDb().comment.count()).toBe(commentRateLimit.count);
});

test("keeps only a keyed hash of the visitor, and only for the current window", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 12, 0, 0)));
  const post = await publishedPost();
  await submitComment(submission(post, { visitor: "203.0.113.7" }));
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 27, 12, 30, 0)));

  await submitComment(submission(post, { visitor: "203.0.113.8" }));

  const rows = await getDb().commentRateLimit.findMany();
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toMatch(/203\.0\.113/);
  expect(rows[0]?.visitorHash).toMatch(/^[0-9a-f]{64}$/);
  const comments = await getDb().comment.findMany();
  expect(JSON.stringify(comments)).not.toMatch(/203\.0\.113/);
});

// Submits a comment from its own visitor, so no test meets the rate limit,
// and returns its id.
async function comment(
  post: { language: "en" | "zh"; slug: string },
  message: string,
): Promise<string> {
  await submitComment(submission(post, { message, visitor: message }));
  const { id } = await getDb().comment.findFirstOrThrow({ where: { message } });
  return id;
}

test("shows approved comments under their post, oldest first, and nothing pending", async () => {
  const post = await publishedPost();
  const later = await comment(post, "Later");
  const earlier = await comment(post, "Earlier");
  await comment(post, "Pending");
  for (const [id, minute] of [
    [later, 5],
    [earlier, 0],
  ] as const) {
    await getDb().comment.update({
      where: { id },
      data: { createdAt: new Date(Date.UTC(2026, 9, 27, 12, minute)) },
    });
    await approveComment(id);
  }

  expect(await listPublicComments("en", post.slug)).toEqual([
    expect.objectContaining({
      id: earlier,
      nickname: "Reader",
      message: "Earlier",
    }),
    expect.objectContaining({ id: later, message: "Later" }),
  ]);
});

test("lists the pending queue with its post and counts it", async () => {
  const post = await publishedPost("Queue");
  const pending = await comment(post, "Waiting");
  await approveComment(await comment(post, "Approved"));

  expect(await countPendingComments()).toBe(1);
  expect(await listCommentsForModeration("pending")).toEqual([
    {
      id: pending,
      nickname: "Reader",
      message: "Waiting",
      createdAt: expect.any(Date),
      post: { id: post.id, title: "Queue" },
    },
  ]);
  expect(
    (await listCommentsForModeration("approved")).map((c) => c.message),
  ).toEqual(["Approved"]);
});

test("rejecting deletes a pending comment, and removing an approved one", async () => {
  const post = await publishedPost();
  const rejected = await comment(post, "Rejected");
  const removed = await comment(post, "Removed");
  await approveComment(removed);

  await rejectComment(rejected);
  await removeComment(removed);

  expect(await getDb().comment.count()).toBe(0);
  expect(await listPublicComments("en", post.slug)).toEqual([]);
});

test("acts only on a comment in the status the owner saw", async () => {
  const post = await publishedPost();
  const approved = await comment(post, "Approved");
  await approveComment(approved);
  const pending = await comment(post, "Pending");

  for (const act of [
    () => approveComment(approved),
    () => rejectComment(approved),
    () => removeComment(pending),
    () => approveComment("00000000-0000-4000-8000-000000000000"),
  ]) {
    await expect(act()).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  expect(await getDb().comment.count()).toBe(2);
});

test("keeps comments of unpublished and trashed posts out of public view", async () => {
  const post = await publishedPost();
  await approveComment(await comment(post, "Approved"));
  await comment(post, "Pending");

  await updatePost(post.id, { status: "draft" });
  await expect(listPublicComments("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });

  await updatePost(post.id, { status: "published" });
  await trashPost(post.id);
  await expect(listPublicComments("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(await countPendingComments()).toBe(0);
  expect(await listCommentsForModeration("pending")).toEqual([]);
  expect(await listCommentsForModeration("approved")).toEqual([]);

  await restorePost(post.id);
  expect(await countPendingComments()).toBe(1);
});
