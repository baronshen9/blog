import { randomBytes } from "node:crypto";
import { slugify } from "@/lib";
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
  updatedAt: Date;
};
export type PostSummary = Pick<
  Post,
  "id" | "language" | "title" | "status" | "updatedAt"
>;
export type PostContent = { title: string; bodyMarkdown: string };

const postFields = {
  id: true,
  language: true,
  title: true,
  slug: true,
  bodyMarkdown: true,
  status: true,
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

// Changes the content only; status and slug stay as they are.
export async function updatePost(
  id: string,
  content: PostContent,
): Promise<Post> {
  await getPost(id);
  return getDb().post.update({
    where: { id },
    data: validate(content),
    select: postFields,
  });
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
