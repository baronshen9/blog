import { createHmac, randomBytes } from "node:crypto";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { getPublishedPostId, type Language } from "@/server/posts";

// The longest nickname and message a reader may send.
export const nicknameMaxLength = 40;
export const messageMaxLength = 2000;

// Each visitor may send this many comments per fixed window.
export const commentRateLimit = { count: 5, windowMinutes: 10 };

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
  if (input.trap) {
    throw new DomainError(
      "VALIDATION",
      "This comment looks automated and was not sent.",
    );
  }
  const nickname = validate(input.nickname, "nickname", nicknameMaxLength);
  const message = validate(input.message, "message", messageMaxLength);
  const postId = await getPublishedPostId(input.language, input.slug).catch(
    (error: unknown) => {
      if (error instanceof DomainError && error.code === "NOT_FOUND") {
        throw new DomainError("NOT_FOUND", "This post accepts no comments.");
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
    throw new DomainError(
      "CONFLICT",
      `You have sent too many comments for now; try again in ${commentRateLimit.windowMinutes} minutes.`,
    );
  }
}

function validate(value: string, name: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainError("VALIDATION", `Enter a ${name}.`);
  if (trimmed.length > maxLength) {
    throw new DomainError(
      "VALIDATION",
      `Keep the ${name} within ${maxLength.toLocaleString("en")} characters.`,
    );
  }
  return trimmed;
}
