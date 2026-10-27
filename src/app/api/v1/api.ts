import { z } from "zod";
import type { ErrorCode, ErrorResponse, PostResponse } from "@/contract";
import { DomainError } from "@/server/errors";
import type { Post } from "@/server/posts";
import { verifyToken } from "@/server/tokens";

const httpStatus: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

// Answers an API request: the handler runs only for a valid Bearer token,
// whose use is recorded; cookies are never read. Failures become the
// contract's error shape.
export async function handleApiRequest(
  request: Request,
  handle: () => Promise<Response>,
): Promise<Response> {
  try {
    await verifyToken(bearerSecret(request));
    return await handle();
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(error.code, error.message);
    }
    if (error instanceof z.ZodError) {
      return errorResponse("VALIDATION", describe(error));
    }
    console.error("API request failed:", error);
    return errorResponse("INTERNAL", "Something went wrong; try again.");
  }
}

// The request's JSON body, checked against a contract schema.
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const body: unknown = await request.json().catch(() => {
    throw new DomainError("VALIDATION", "Send the request body as JSON.");
  });
  return schema.parse(body);
}

// The post id from the route; a malformed one cannot name a post.
export async function readPostId(params: Promise<{ id: string }>) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) {
    throw new DomainError("VALIDATION", "A post id is a UUID.");
  }
  return id.data;
}

export function toPostResponse(post: Post): PostResponse {
  return {
    ...post,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
  };
}

// A missing or malformed header yields an empty secret, which no token has.
function bearerSecret(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return /^Bearer +(\S+)$/i.exec(header)?.[1] ?? "";
}

function errorResponse(code: ErrorCode, message: string): Response {
  const body: ErrorResponse = { error: { code, message } };
  return Response.json(body, { status: httpStatus[code] });
}

function describe(error: z.ZodError): string {
  return error.issues
    .map(({ path, message }) =>
      path.length ? `${path.join(".")}: ${message}` : message,
    )
    .join("; ");
}
