import { randomBytes } from "node:crypto";
import { excerpt, slugify } from "@/lib";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";

export const languages = ["zh", "en"] as const;
export type Language = (typeof languages)[number];
export type PostStatus = "draft" | "published";

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
  const { title, bodyMarkdown } = validate(content);
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

// Changes the content, and the status when one is given; the slug never
// changes. The first publication sets publishedAt, which unpublishing and
// publishing again keep; only a publication writes it, and only while it is
// empty, so concurrent saves cannot lose or move it.
export async function updatePost(
  id: string,
  { status, ...content }: PostContent & { status?: PostStatus },
): Promise<Post> {
  const data = { ...validate(content), status };
  await getPost(id);
  return getDb().$transaction(async (tx) => {
    if (status === "published") {
      await tx.post.updateMany({
        where: { id, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }
    return tx.post.update({ where: { id }, data, select: postFields });
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
  if (!post?.publishedAt) {
    throw new DomainError("NOT_FOUND", "This post does not exist.");
  }
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
  if (!post) throw new DomainError("NOT_FOUND", "This post does not exist.");
  return post;
}

// Every post outside the trash, most recently changed first.
export async function listPosts(): Promise<PostSummary[]> {
  return getDb().post.findMany({
    where: { deletedAt: null },
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

function validate({ title, bodyMarkdown }: PostContent): PostContent {
  const trimmed = title.trim();
  if (!trimmed) throw new DomainError("VALIDATION", "Enter a title.");
  return { title: trimmed, bodyMarkdown };
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
