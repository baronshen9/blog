import { randomBytes } from "node:crypto";
import { languages, postStatuses } from "@/contract";
import { excerpt, isSlug, slugify } from "@/lib";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";

export { languages };
export type Language = (typeof languages)[number];
export type PostStatus = (typeof postStatuses)[number];

export type Post = {
  id: string;
  language: Language;
  title: string;
  slug: string;
  bodyMarkdown: string;
  status: PostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
};
export type PostSummary = Pick<
  Post,
  "id" | "language" | "title" | "status" | "updatedAt"
>;
export type TrashedPostSummary = Pick<Post, "id" | "language" | "title"> & {
  trashedAt: Date;
};
export type PostContent = { title: string; bodyMarkdown: string };
export type PublishedPost = Pick<
  Post,
  "language" | "title" | "slug" | "bodyMarkdown"
> & { publishedAt: Date };
export type PublishedPostSummary = Omit<PublishedPost, "bodyMarkdown"> & {
  excerpt: string;
};
export type PublishedPostPage = {
  posts: PublishedPostSummary[];
  page: number;
  pageCount: number;
};

// Posts per page of the public list.
export const publishedPageSize = 10;

const postFields = {
  id: true,
  language: true,
  title: true,
  slug: true,
  bodyMarkdown: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
} as const;

// A new post is a draft in its own translation group. Its slug comes from the
// title, or is a short random id when the title has no Latin characters; when
// a concurrent save takes the same slug first, the next free one is used.
// Every round of colliding saves lets at least one through, so the bound is
// reached only by an implausible number of simultaneous saves.
export async function createDraft({
  language,
  ...content
}: PostContent & { language: Language }): Promise<Post> {
  const title = validateTitle(content.title);
  const { bodyMarkdown } = content;
  const base = slugify(title) || shortId();
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      return await getDb().post.create({
        data: {
          language,
          title,
          bodyMarkdown,
          slug: await availableSlug(language, base),
        },
        select: postFields,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new DomainError("CONFLICT", "No free slug was found; save again.");
}

// Changes the title, the body, the status, and the slug, each only when given.
// The slug changes only while the post has never been published; giving
// a published post its current slug is not a change. The first publication
// sets publishedAt, which unpublishing and publishing again keep; only a
// publication writes it, and only while it is empty, so concurrent saves
// cannot lose or move it. A save that changes the slug and publishes publishes
// the new slug. The first write applies only outside the trash and locks the
// post, so a post trashed or deleted meanwhile is not found rather than changed.
export async function updatePost(
  id: string,
  {
    title,
    bodyMarkdown,
    status,
    slug,
  }: Partial<PostContent> & { status?: PostStatus; slug?: string },
): Promise<Post> {
  const data = {
    title: title === undefined ? undefined : validateTitle(title),
    bodyMarkdown,
    status,
  };
  const newSlug = slug === undefined ? undefined : validateSlug(slug);
  return getDb().$transaction(async (tx) => {
    const { count } = await tx.post.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    if (count === 0) notFound();
    if (newSlug !== undefined) {
      const { count } = await tx.post
        .updateMany({
          where: { id, OR: [{ publishedAt: null }, { slug: newSlug }] },
          data: { slug: newSlug },
        })
        .catch((error: unknown) => {
          if (!isUniqueViolation(error)) throw error;
          throw new DomainError(
            "CONFLICT",
            `Another post in this language already uses the slug "${newSlug}"; it may be in the trash.`,
          );
        });
      if (count === 0) {
        throw new DomainError(
          "CONFLICT",
          "The slug cannot change after the post's first publication.",
        );
      }
    }
    if (status === "published") {
      await tx.post.updateMany({
        where: { id, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }
    return tx.post.findUniqueOrThrow({ where: { id }, select: postFields });
  });
}

// A published-post query, the only way public pages read posts: a published
// post outside the trash, by its URL.
export async function getPublishedPost(
  language: Language,
  slug: string,
): Promise<PublishedPost> {
  const post = await getDb().post.findFirst({
    where: { language, slug, status: "published", deletedAt: null },
    select: {
      language: true,
      title: true,
      slug: true,
      bodyMarkdown: true,
      publishedAt: true,
    },
  });
  if (!post?.publishedAt) notFound();
  return { ...post, publishedAt: post.publishedAt };
}

// A published-post query: one page of published posts outside the trash,
// newest publication first, in every language until M5 decides which posts a
// language's list shows. Pages count from 1; the first page exists even when
// it is empty, and a page past the last is not found.
export async function listPublishedPosts(
  page: number,
): Promise<PublishedPostPage> {
  const where = { status: "published", deletedAt: null } as const;
  const count = await getDb().post.count({ where });
  const pageCount = Math.max(1, Math.ceil(count / publishedPageSize));
  if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
    throw new DomainError("NOT_FOUND", "This page does not exist.");
  }
  const posts = await getDb().post.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * publishedPageSize,
    take: publishedPageSize,
    select: {
      language: true,
      title: true,
      slug: true,
      bodyMarkdown: true,
      publishedAt: true,
    },
  });
  return {
    posts: posts.flatMap(({ bodyMarkdown, publishedAt, ...post }) =>
      publishedAt
        ? [{ ...post, publishedAt, excerpt: excerpt(bodyMarkdown) }]
        : [],
    ),
    page,
    pageCount,
  };
}

export async function getPost(id: string): Promise<Post> {
  const post = await getDb().post.findFirst({
    where: { id, deletedAt: null },
    select: postFields,
  });
  if (!post) notFound();
  return post;
}

// Every post outside the trash, most recently changed first; only those with
// the given status when one is given.
export async function listPosts(status?: PostStatus): Promise<PostSummary[]> {
  return getDb().post.findMany({
    where: { deletedAt: null, status },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      language: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });
}

// Moves a post outside the trash into it; it keeps its status and slug.
export async function trashPost(id: string): Promise<void> {
  const { count } = await getDb().post.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) notFound();
}

// Every trashed post, most recently trashed first.
export async function listTrashedPosts(): Promise<TrashedPostSummary[]> {
  const posts = await getDb().post.findMany({
    where: { deletedAt: { not: null } },
    orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
    select: { id: true, language: true, title: true, deletedAt: true },
  });
  return posts.flatMap(({ deletedAt, ...post }) =>
    deletedAt ? [{ ...post, trashedAt: deletedAt }] : [],
  );
}

// Takes a post out of the trash as a draft; it keeps its slug and first
// publication date.
export async function restorePost(id: string): Promise<void> {
  const { count } = await getDb().post.updateMany({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null, status: "draft" },
  });
  if (count === 0) notFound();
}

// Deletes a trashed post for good. Admin-only: the API never exposes it, so
// a post leaves the database only after passing through the trash.
export async function deletePostPermanently(id: string): Promise<void> {
  const { count } = await getDb().post.deleteMany({
    where: { id, deletedAt: { not: null } },
  });
  if (count === 0) notFound();
}

function notFound(): never {
  throw new DomainError("NOT_FOUND", "This post does not exist.");
}

function validateTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new DomainError("VALIDATION", "Enter a title.");
  return trimmed;
}

function validateSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!isSlug(trimmed)) {
    throw new DomainError(
      "VALIDATION",
      "Use only lowercase Latin letters, digits, and single hyphens between them for the slug.",
    );
  }
  return trimmed;
}

// Slugs are unique per language, trashed posts included; a taken slug gets
// the first free numeric suffix.
async function availableSlug(language: Language, base: string) {
  const posts = await getDb().post.findMany({
    where: { language, slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(posts.map(({ slug }) => slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// Prisma's error code for a unique constraint violation.
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

function shortId(): string {
  return randomBytes(4).toString("hex");
}
