// The blog's MCP tools: each one validates its arguments with the contract
// schemas, calls the HTTP API under /api/v1 with the owner's token, and turns
// the answer into text for the conversation. Content rules live in the API;
// nothing here decides what a post may be. Node runs this file without a
// build, so it uses only erasable TypeScript.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import {
  createPostRequest,
  errorResponse,
  listPostsQuery,
  postListResponse,
  postResponse,
  updatePostRequest,
} from "../contract/index.ts";

export type BlogConfig = {
  // BLOG_URL and BLOG_API_TOKEN from the assistant's MCP configuration.
  url: string | undefined;
  token: string | undefined;
  fetch: typeof fetch;
};

type Call = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
};

const id = { id: postResponse.shape.id.describe("The post's id.") };

export function createBlogServer(config: BlogConfig): McpServer {
  const server = new McpServer({ name: "blog", version: "1.0.0" });
  const api = <T>(call: Call, schema?: z.ZodType<T>) =>
    request(config, call, schema);

  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "List the blog's posts outside the trash, most recently changed first, optionally only drafts or only published posts.",
      inputSchema: listPostsQuery.shape,
      annotations: { readOnlyHint: true },
    },
    ({ status }) =>
      api(
        { method: "GET", path: status ? `/posts?status=${status}` : "/posts" },
        postListResponse,
      ),
  );

  server.registerTool(
    "get_post",
    {
      title: "Read a post",
      description: "Read one post, including its Markdown body.",
      inputSchema: id,
      annotations: { readOnlyHint: true },
    },
    ({ id }) => api({ method: "GET", path: `/posts/${id}` }, postResponse),
  );

  server.registerTool(
    "create_draft",
    {
      title: "Create a draft",
      description:
        "Create a draft post in Chinese (zh) or English (en) with a title and a Markdown body. The slug is generated from the title.",
      inputSchema: createPostRequest.shape,
    },
    (draft) =>
      api({ method: "POST", path: "/posts", body: draft }, postResponse),
  );

  server.registerTool(
    "update_post",
    {
      title: "Edit a post",
      description:
        "Change a post's title, Markdown body, or slug; only the fields given change. The slug can change only before the post's first publication.",
      inputSchema: {
        ...id,
        title: updatePostRequest.shape.title,
        bodyMarkdown: updatePostRequest.shape.bodyMarkdown,
        slug: updatePostRequest.shape.slug,
      },
    },
    ({ id, ...fields }) =>
      api(
        { method: "PATCH", path: `/posts/${id}`, body: fields },
        postResponse,
      ),
  );

  server.registerTool(
    "publish_post",
    {
      title: "Publish a post",
      description: "Publish a post so that it appears on the public site.",
      inputSchema: id,
    },
    ({ id }) =>
      api(
        {
          method: "PATCH",
          path: `/posts/${id}`,
          body: { status: "published" },
        },
        postResponse,
      ),
  );

  server.registerTool(
    "unpublish_post",
    {
      title: "Unpublish a post",
      description:
        "Return a published post to draft so that it no longer appears on the public site.",
      inputSchema: id,
    },
    ({ id }) =>
      api(
        { method: "PATCH", path: `/posts/${id}`, body: { status: "draft" } },
        postResponse,
      ),
  );

  server.registerTool(
    "delete_post",
    {
      title: "Delete a post",
      description:
        "Move a post to the trash and off the public site. The owner can restore it from the admin's trash.",
      inputSchema: id,
      annotations: { destructiveHint: true },
    },
    ({ id }) => api({ method: "DELETE", path: `/posts/${id}` }),
  );

  return server;
}

// One API call as a tool result: the response body as JSON text, or a
// plain-language error the assistant can relay to the owner.
async function request<T>(
  { url, token, fetch }: BlogConfig,
  { method, path, body }: Call,
  schema?: z.ZodType<T>,
): Promise<CallToolResult> {
  if (!url) return failure(notConfigured("BLOG_URL"));
  if (!token) return failure(notConfigured("BLOG_API_TOKEN"));
  let endpoint: URL;
  try {
    endpoint = new URL(`/api/v1${path}`, url);
  } catch {
    return failure(
      `BLOG_URL "${url}" is not a URL. Set it to the blog's address, such as http://127.0.0.1:3000, in this MCP server's configuration.`,
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return failure(
      `The blog at ${url} cannot be reached. Start it (for example with docker compose up) and check BLOG_URL in this MCP server's configuration.`,
    );
  }

  const json: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    if (!schema) return success("The post is in the trash now.");
    const parsed = schema.safeParse(json);
    if (parsed.success) return success(JSON.stringify(parsed.data, null, 2));
  } else {
    const parsed = errorResponse.safeParse(json);
    if (parsed.success) return failure(describe(parsed.data));
  }
  return failure(
    `The blog at ${url} answered with HTTP ${response.status}, which is not a response of the blog's API. Check that BLOG_URL points at the blog.`,
  );
}

function describe({ error }: z.infer<typeof errorResponse>): string {
  switch (error.code) {
    case "UNAUTHORIZED":
      return "The blog refused the API token. Check BLOG_API_TOKEN in this MCP server's configuration; if the token was revoked, create a new one in the admin under API tokens.";
    case "NOT_FOUND":
      return `${error.message} Check the id with list_posts; deleted posts are in the admin's trash.`;
    case "VALIDATION":
    case "CONFLICT":
      return `The blog did not accept the request: ${error.message}`;
    case "INTERNAL":
      return "The blog failed while handling the request. Try again; if it keeps failing, check the blog's logs.";
  }
}

function notConfigured(variable: string): string {
  return `${variable} is not set. Add it to the environment of this MCP server in the assistant's configuration; see the blog's README.`;
}

function success(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function failure(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}
