import { randomBytes } from "node:crypto";
import { languages, postStatuses } from "@/contract";
import {
  excerpt,
  isSlug,
  isTag,
  maxTagLength,
  normalizeTag,
  slugify,
} from "@/lib";
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
  tags: string[];
  status: PostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  // The post's other language version, in the trash or not; null until one
  // is created.
  translation: Translation | null;
};
export type Translation = Pick<Post, "id" | "language" | "title" | "status"> & {
  trashed: boolean;
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
  "language" | "title" | "slug" | "bodyMarkdown" | "tags"
> & { publishedAt: Date };
// A published post's other language version as readers reach it.
export type PublishedTranslation = Pick<
  PublishedPost,
  "language" | "title" | "slug"
>;
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

const publishedPostFields = {
  language: true,
  title: true,
  slug: true,
  bodyMarkdown: true,
  tags: true,
  publishedAt: true,
} as const;

const postFields = {
  id: true,
  language: true,
  title: true,
  slug: true,
  bodyMarkdown: true,
  tags: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  translationGroupId: true,
} as const;

const languageNames = { zh: "Chinese", en: "English" } as const;

// A new post is a draft in its own translation group, with the given tags or
// none. Its slug comes from the title, or is a short random id when the title
// has no Latin characters; when a concurrent save takes the same slug first,
// the next free one is used.
export async function createDraft({
  language,
  ...content
}: PostContent & { language: Language; tags?: string[] }): Promise<Post> {
  return insertDraft(language, undefined, content);
}

// A translation of a post outside the trash: a draft in the post's other
// language that joins its translation group, made like a new post. A group
// holds one post per language, trashed posts included, so a post whose other
// version exists, even in the trash, gets no new translation.
export async function createTranslation(
  sourceId: string,
  content: PostContent & { tags?: string[] },
): Promise<Post> {
  const source = await getDb().post.findFirst({
    where: { id: sourceId, deletedAt: null },
    select: { language: true, translationGroupId: true },
  });
  if (!source) notFound();
  return insertDraft(
    otherLanguage(source.language),
    source.translationGroupId,
    content,
  );
}

// The language a translation of a post in `language` is written in.
export function otherLanguage(language: Language): Language {
  return language === "zh" ? "en" : "zh";
}

// Inserts a draft in the given translation group, or in a new one. A unique
// violation is either a slug taken meanwhile, which the next attempt avoids,
// or the group's version in this language created meanwhile, which is final.
// Every round of colliding saves lets at least one through, so the bound is
// reached only by an implausible number of simultaneous saves.
async function insertDraft(
  language: Language,
  translationGroupId: string | undefined,
  content: PostContent & { tags?: string[] },
): Promise<Post> {
  const title = validateTitle(content.title);
  const tags = validateTags(content.tags ?? []);
  const { bodyMarkdown } = content;
  const base = slugify(title) || shortId();
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const post = await getDb().post.create({
        data: {
          language,
          translationGroupId,
          title,
          bodyMarkdown,
          tags,
          slug: await availableSlug(language, base),
        },
        select: postFields,
      });
      return await withTranslation(getDb(), post);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (
        translationGroupId &&
        (await getDb().post.count({ where: { translationGroupId, language } }))
      ) {
        throw new DomainError(
          "CONFLICT",
          `This post already has its ${languageNames[language]} version; it may be in the trash.`,
        );
      }
    }
  }
  throw new DomainError("CONFLICT", "No free slug was found; save again.");
}

// Changes the title, the body, the tags, the status, and the slug, each only
// when given; given tags replace the post's tags.
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
    tags,
    status,
    slug,
  }: Partial<PostContent> & {
    tags?: string[];
    status?: PostStatus;
    slug?: string;
  },
): Promise<Post> {
  const data = {
    title: title === undefined ? undefined : validateTitle(title),
    bodyMarkdown,
    tags: tags === undefined ? undefined : validateTags(tags),
    status,
    // Set explicitly so a slug-only save still writes, and therefore locks.
    updatedAt: new Date(),
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
    return withTranslation(
      tx,
      await tx.post.findUniqueOrThrow({ where: { id }, select: postFields }),
    );
  });
}

// A published-post query, the only way public pages read posts: a published
// post outside the trash, by its URL, with its other language version when
// that one is published and outside the trash too.
export async function getPublishedPost(
  language: Language,
  slug: string,
): Promise<PublishedPost & { translation: PublishedTranslation | null }> {
  const { translationGroupId, ...post } =
    (await getDb().post.findFirst({
      where: { language, slug, status: "published", deletedAt: null },
      select: { ...publishedPostFields, translationGroupId: true },
    })) ?? notFound();
  if (!post.publishedAt) notFound();
  const translation = await getDb().post.findFirst({
    where: {
      translationGroupId,
      language: otherLanguage(language),
      status: "published",
      deletedAt: null,
    },
    select: { language: true, title: true, slug: true },
  });
  return { ...post, publishedAt: post.publishedAt, translation };
}

// A published-post query for what readers attach to a post, such as a
// comment: the id of a published post outside the trash, by its URL.
export async function getPublishedPostId(
  language: Language,
  slug: string,
): Promise<string> {
  const post = await getDb().post.findFirst({
    where: { language, slug, status: "published", deletedAt: null },
    select: { id: true },
  });
  if (!post) notFound();
  return post.id;
}

// A published-post query: one page of the published posts outside the trash
// that a language's list shows, newest publication first. A list shows each
// translation group once: its version in the language when that is published,
// otherwise its published version in the other language. Pages count from 1;
// the first page exists even when it is empty, and a page past the last is not
// found.
export async function listPublishedPosts(
  language: Language,
  page: number,
): Promise<PublishedPostPage> {
  return publishedPostPage(language, page);
}

// A published-post query: one page of the published posts outside the trash
// in a language's list whose title or body contains the query, ignoring case,
// ordered and paged like listPublishedPosts. A substring match
// finds Chinese words, which have no spaces between them, as reliably as
// English ones. A query of only spaces is refused, because every post
// contains the empty string.
export async function searchPublishedPosts(
  language: Language,
  query: string,
  page: number,
): Promise<PublishedPostPage> {
  const text = query.trim();
  if (!text) throw new DomainError("VALIDATION", "Enter a word to search for.");
  return publishedPostPage(language, page, { search: text });
}

// A published-post query: one page of the published posts outside the trash
// in a language's list that carry the tag, ordered and paged like
// listPublishedPosts, with the tag's canonical name. The name is compared
// normalized, so any spelling of a tag finds it. A tag that no post in the
// language's list carries does not exist there: it is not found, as is any
// page of it.
export async function listPublishedPostsByTag(
  language: Language,
  tag: string,
  page: number,
): Promise<PublishedPostPage & { tag: string }> {
  const name = normalizeTag(tag);
  const result = await publishedPostPage(language, page, { tag: name });
  if (result.posts.length === 0) {
    throw new DomainError("NOT_FOUND", "This tag does not exist.");
  }
  return { ...result, tag: name };
}

// One page of a language's list of published posts outside the trash, only
// those containing the search text or carrying the tag when one is given. A
// post in the other language belongs to the list only when its translation
// group has no published version in the language, whether that version
// matches or not. Prisma passes `contains` to ILIKE unescaped,
// so LIKE's wildcards and escape character are escaped to match literally.
async function publishedPostPage(
  language: Language,
  page: number,
  { search, tag }: { search?: string; tag?: string } = {},
): Promise<PublishedPostPage> {
  const contains = {
    contains: search?.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive",
  } as const;
  const matching = {
    status: "published",
    deletedAt: null,
    ...(search && { OR: [{ title: contains }, { bodyMarkdown: contains }] }),
    ...(tag !== undefined && { tags: { has: tag } }),
  } as const;
  const shownGroups = await getDb().post.findMany({
    where: { status: "published", deletedAt: null, language },
    select: { translationGroupId: true },
  });
  const where = {
    AND: [
      matching,
      {
        OR: [
          { language },
          {
            translationGroupId: {
              notIn: shownGroups.map((post) => post.translationGroupId),
            },
          },
        ],
      },
    ],
  };
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
    select: publishedPostFields,
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
  return withTranslation(getDb(), post);
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

// The post with its other language version: the other post of its
// translation group, if there is one.
async function withTranslation(
  db: Pick<ReturnType<typeof getDb>, "post">,
  {
    translationGroupId,
    ...post
  }: Omit<Post, "translation"> & { translationGroupId: string },
): Promise<Post> {
  const other = await db.post.findFirst({
    where: { translationGroupId, id: { not: post.id } },
    select: {
      id: true,
      language: true,
      title: true,
      status: true,
      deletedAt: true,
    },
  });
  const translation = other && {
    id: other.id,
    language: other.language,
    title: other.title,
    status: other.status,
    trashed: other.deletedAt !== null,
  };
  return { ...post, translation };
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

// The admin and the API both pass tags through here, so they accept and reject
// the same names. Names are normalized (lib/tag.ts); spellings that normalize
// alike are one tag, kept once in the order first given.
function validateTags(tags: string[]): string[] {
  const names = new Set(tags.map(normalizeTag).filter(Boolean));
  for (const name of names) {
    if (!isTag(name)) {
      throw new DomainError(
        "VALIDATION",
        `The tag "${name}" is not valid: use letters, digits, and single hyphens, at most ${maxTagLength} characters.`,
      );
    }
  }
  return [...names];
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
