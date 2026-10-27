// The HTTP API under /api/v1: request and response schemas shared by the route
// handlers and the MCP server. The MCP server runs this file with Node's type
// stripping, so it uses only erasable TypeScript and imports nothing from src/.
import { z } from "zod";

export const languages = ["zh", "en"] as const;
export const postStatuses = ["draft", "published"] as const;

const language = z.enum(languages);
const status = z.enum(postStatuses);
const timestamp = z.iso.datetime();
// The blog normalizes tag names and rejects invalid ones; see the posts service.
const tags = z
  .array(z.string())
  .describe(
    "The post's tags; an edit replaces all of them. The blog lowercases each name and turns spaces into hyphens; a name has letters, digits, and single hyphens only.",
  );

// GET /posts?status=…: every post outside the trash, most recently changed
// first, optionally only those with one status.
export const listPostsQuery = z.strictObject({ status: status.optional() });

// POST /posts: a new draft. The slug comes from the title; tags are optional.
export const createPostRequest = z.strictObject({
  language,
  title: z.string(),
  bodyMarkdown: z.string(),
  tags: tags.optional(),
});

// PATCH /posts/{id}: changes only the fields given. `status` publishes or
// unpublishes; `slug` can change only before the first publication; `tags`
// replaces the post's tags.
export const updatePostRequest = z
  .strictObject({
    title: z.string().optional(),
    bodyMarkdown: z.string().optional(),
    slug: z.string().optional(),
    tags: tags.optional(),
    status: status.optional(),
  })
  .refine((fields) => Object.values(fields).some((v) => v !== undefined), {
    message: "Give at least one field to change.",
  });

// GET, POST, and PATCH of a post respond with the post.
export const postResponse = z.object({
  id: z.uuid(),
  language,
  title: z.string(),
  slug: z.string(),
  bodyMarkdown: z.string(),
  tags: z.array(z.string()),
  status,
  publishedAt: timestamp.nullable(),
  updatedAt: timestamp,
});

export const postListResponse = z.object({
  posts: z.array(
    postResponse.pick({
      id: true,
      language: true,
      title: true,
      status: true,
      updatedAt: true,
    }),
  ),
});

// Every failed request responds with this shape. INTERNAL is an unexpected
// failure on the server; its message says nothing about the cause.
export const errorCodes = [
  "UNAUTHORIZED",
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
] as const;
export const errorResponse = z.object({
  error: z.object({ code: z.enum(errorCodes), message: z.string() }),
});

export type ListPostsQuery = z.infer<typeof listPostsQuery>;
export type CreatePostRequest = z.infer<typeof createPostRequest>;
export type UpdatePostRequest = z.infer<typeof updatePostRequest>;
export type PostResponse = z.infer<typeof postResponse>;
export type PostListResponse = z.infer<typeof postListResponse>;
export type ErrorCode = (typeof errorCodes)[number];
export type ErrorResponse = z.infer<typeof errorResponse>;
