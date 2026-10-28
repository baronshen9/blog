import { createHmac, randomBytes } from "node:crypto";
import { messages, type CommentLimits, type CommentRefusal } from "@/messages";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { getPublishedPostId, type Language } from "@/server/posts";

// The longest nickname and message a reader may send.
export const nicknameMaxLength = 40;
export const messageMaxLength = 2000;

// Each visitor may send this many comments per fixed window.
export const commentRateLimit = { count: 5, windowMinutes: 10 };

// The limits a refusal names, for interfaces that phrase it themselves.
export const commentLimits: CommentLimits = {
  nicknameMaxLength,
  messageMaxLength,
  windowMinutes: commentRateLimit.windowMinutes,
};

// A refused comment. The reason lets the public pages say why in the
// reader's language; the message says it in English.
export class CommentRefused extends DomainError {
  readonly reason: CommentRefusal;

  constructor(code: DomainError["code"], reason: CommentRefusal) {
    super(code, messages.en.comments.refusals[reason](commentLimits));
    this.reason = reason;
  }
}

export type CommentSubmission = {
  language: Language;
  slug: string;
  nickname: string;
  message: string;
  // The form's hidden field: people never see it, automated senders fill it.
  trap: string;
  // The visitor's network address; only a keyed hash of it is stored.
  visitor: string;
};

// The key that hashes visitor addresses. It lives only in this process, so a
// stored hash cannot be traced back to an address by trying every address;
// a restart starts every visitor's count afresh.
const visitorKey = randomBytes(32);

// Stores a reader's comment on a published post as pending, for the owner to
// moderate; nothing pending is shown publicly. A filled hidden field, an empty
// or overlong nickname or message, a post that is not published, and a
// visitor over the rate limit are refused with the reason, and nothing is
// stored. A post unpublished between the check and the write keeps a pending
// comment that is never shown while the post is not public.
export async function submitComment(input: CommentSubmission): Promise<void> {
  if (input.trap) throw new CommentRefused("VALIDATION", "automated");
  const nickname = validate(input.nickname, nicknameMaxLength, {
    missing: "nicknameMissing",
    tooLong: "nicknameTooLong",
  });
  const message = validate(input.message, messageMaxLength, {
    missing: "messageMissing",
    tooLong: "messageTooLong",
  });
  const postId = await getPublishedPostId(input.language, input.slug).catch(
    (error: unknown) => {
      if (error instanceof DomainError && error.code === "NOT_FOUND") {
        throw new CommentRefused("NOT_FOUND", "closed");
      }
      throw error;
    },
  );
  await countSubmission(input.visitor);
  await getDb().comment.create({ data: { postId, nickname, message } });
}

// Counts a submission against the visitor's current window and refuses it
// above the limit. The count is one statement, so simultaneous submissions
// cannot all slip under the limit. Windows that have ended are removed.
async function countSubmission(visitor: string): Promise<void> {
  const windowMs = commentRateLimit.windowMinutes * 60_000;
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));
  const visitorHash = createHmac("sha256", visitorKey)
    .update(visitor)
    .digest("hex");
  const db = getDb();
  await db.commentRateLimit.deleteMany({
    where: { windowStart: { lt: windowStart } },
  });
  const [counted] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "CommentRateLimit" ("visitorHash", "windowStart", "count")
    VALUES (${visitorHash}, ${windowStart}, 1)
    ON CONFLICT ("visitorHash", "windowStart")
    DO UPDATE SET "count" = "CommentRateLimit"."count" + 1
    RETURNING "count"`;
  if ((counted?.count ?? 0) > commentRateLimit.count) {
    throw new CommentRefused("CONFLICT", "rateLimited");
  }
}

function validate(
  value: string,
  maxLength: number,
  refusals: { missing: CommentRefusal; tooLong: CommentRefusal },
): string {
  const trimmed = value.trim();
  if (!trimmed) throw new CommentRefused("VALIDATION", refusals.missing);
  if (trimmed.length > maxLength) {
    throw new CommentRefused("VALIDATION", refusals.tooLong);
  }
  return trimmed;
}

export type PublicComment = {
  id: string;
  nickname: string;
  message: string;
  createdAt: Date;
};
export type ModeratedComment = PublicComment & {
  post: { id: string; title: string };
};
export type CommentStatus = "pending" | "approved";

const publicCommentFields = {
  id: true,
  nickname: true,
  message: true,
  createdAt: true,
} as const;

// A published post's approved comments, oldest first. The post is found
// through the `posts` published-post query, so comments of drafts and
// trashed posts are never public.
export async function listPublicComments(
  language: Language,
  slug: string,
): Promise<PublicComment[]> {
  const postId = await getPublishedPostId(language, slug);
  return getDb().comment.findMany({
    where: { postId, status: "approved" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: publicCommentFields,
  });
}

// The comments with the given status on posts outside the trash, for the
// owner: the pending queue oldest first, approved comments newest first.
// Comments of a trashed post wait with it and return when it is restored.
export async function listCommentsForModeration(
  status: CommentStatus,
): Promise<ModeratedComment[]> {
  const order = status === "pending" ? "asc" : "desc";
  return getDb().comment.findMany({
    where: { status, post: { deletedAt: null } },
    orderBy: [{ createdAt: order }, { id: order }],
    select: {
      ...publicCommentFields,
      post: { select: { id: true, title: true } },
    },
  });
}

// How many comments on posts outside the trash await moderation.
export async function countPendingComments(): Promise<number> {
  return getDb().comment.count({
    where: { status: "pending", post: { deletedAt: null } },
  });
}

// Approves a pending comment; it then shows under its post while the post is
// published.
export async function approveComment(id: string): Promise<void> {
  const { count } = await getDb().comment.updateMany({
    where: { id, status: "pending" },
    data: { status: "approved" },
  });
  if (count === 0) commentNotFound();
}

// Rejects a pending comment: it is deleted and never shown.
export async function rejectComment(id: string): Promise<void> {
  await deleteComment(id, "pending");
}

// Removes an approved comment: it is deleted and leaves its post.
export async function removeComment(id: string): Promise<void> {
  await deleteComment(id, "approved");
}

// Deletes a comment only in the status the owner saw, so a stale page cannot
// reject a comment that was approved in the meantime.
async function deleteComment(id: string, status: CommentStatus): Promise<void> {
  const { count } = await getDb().comment.deleteMany({
    where: { id, status },
  });
  if (count === 0) commentNotFound();
}

function commentNotFound(): never {
  throw new DomainError("NOT_FOUND", "This comment does not exist.");
}
