import { refresh } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { ensureOwner, signIn, signOut } from "@/server/auth";
import {
  approveComment,
  listCommentsForModeration,
  submitComment,
} from "@/server/comments";
import { createDraft, updatePost } from "@/server/posts";
import { sessionCookie } from "@/app/admin/session-cookie";
import OwnerLayout from "@/app/admin/(owner)/layout";
import {
  approveCommentAction,
  rejectCommentAction,
  removeCommentAction,
} from "./actions";

// The session cookie of the request the actions run in, if any.
const request = vi.hoisted(() => ({
  session: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === sessionCookie.name && request.session !== undefined
        ? { name, value: request.session }
        : undefined,
  }),
}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
// Refreshing the page renders the layout again with the new pending count.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

beforeEach(() => {
  request.session = undefined;
  vi.mocked(refresh).mockClear();
});

const owner = { username: "owner", password: "owner-password" };

async function signedInSession(): Promise<string> {
  await ensureOwner(owner);
  return (await signIn(owner)).token;
}

// A published post with one comment for each status given, in that order.
async function comments(...statuses: ("pending" | "approved")[]) {
  const draft = await createDraft({
    language: "en",
    title: "Discussed",
    bodyMarkdown: "",
  });
  const post = await updatePost(draft.id, { status: "published" });
  const created = [];
  for (const [n, status] of statuses.entries()) {
    await submitComment({
      language: post.language,
      slug: post.slug,
      nickname: "Reader",
      message: `Comment ${n}`,
      trap: "",
      visitor: "203.0.113.7",
    });
    const [comment] = await listCommentsForModeration("pending").then((list) =>
      list.filter(({ message }) => message === `Comment ${n}`),
    );
    if (status === "approved") await approveComment(comment!.id);
    created.push(comment!);
  }
  return created;
}

// Every comment as the owner sees it, pending and approved.
async function allComments() {
  return {
    pending: await listCommentsForModeration("pending"),
    approved: await listCommentsForModeration("approved"),
  };
}

function commentForm(id: string): FormData {
  const form = new FormData();
  form.set("id", id);
  return form;
}

// The number of pending comments the admin navigation shows.
async function pendingCount(): Promise<number> {
  const frame = await OwnerLayout({ children: null });
  return frame.props.pendingComments;
}

test.each([
  ["no session", async () => undefined],
  ["an unknown session", async () => "not-a-session"],
  [
    "a signed-out session",
    async () => {
      const token = await signedInSession();
      await signOut(token);
      return token;
    },
  ],
])(
  "moderation with %s redirects to sign-in and changes nothing",
  async (_, session) => {
    request.session = await session();
    const [pending, rejectable, approved] = await comments(
      "pending",
      "pending",
      "approved",
    );
    const before = await allComments();

    for (const [action, comment] of [
      [approveCommentAction, pending],
      [rejectCommentAction, rejectable],
      [removeCommentAction, approved],
    ] as const) {
      await expect(action(commentForm(comment!.id))).rejects.toMatchObject({
        digest: expect.stringContaining(";/admin/sign-in;"),
      });
    }

    await expect(allComments()).resolves.toEqual(before);
  },
);

test("the pending count drops after approving and after rejecting", async () => {
  request.session = await signedInSession();
  const [approved, rejected] = await comments("pending", "pending", "pending");
  await expect(pendingCount()).resolves.toBe(3);

  await approveCommentAction(commentForm(approved!.id));
  expect(refresh).toHaveBeenCalledTimes(1);
  await expect(pendingCount()).resolves.toBe(2);

  await rejectCommentAction(commentForm(rejected!.id));
  expect(refresh).toHaveBeenCalledTimes(2);
  await expect(pendingCount()).resolves.toBe(1);
});
