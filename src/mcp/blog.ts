// The blog's MCP tools: each one validates its arguments with the contract
// schemas, calls the HTTP API under /api/v1 with the owner's token, and turns
// the answer into text for the conversation. Content rules live in the API;
// nothing here decides what a post may be. Node runs this file without a
// build, so it uses only erasable TypeScript.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  type CallToolResult,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

type ToolSpec<A, R> = {
  name: string;
  title: string;
  description: string;
  input: z.ZodType<A>;
  annotations?: ToolAnnotations;
  call: (args: A) => Call;
  // The success response's schema; none for an empty response.
  response?: z.ZodType<R>;
};

type BlogTool = {
  definition: Tool;
  run: (args: unknown, config: BlogConfig) => Promise<CallToolResult>;
};

const postId = z.strictObject({
  id: postResponse.shape.id.describe("The post's id, as list_posts shows it."),
});
const { title, bodyMarkdown, slug, tags } = updatePostRequest.shape;

const tools: BlogTool[] = [
  tool({
    name: "list_posts",
    title: "List posts",
    description:
      "List the blog's posts outside the trash, most recently changed first, optionally only drafts or only published posts.",
    input: listPostsQuery,
    annotations: { readOnlyHint: true },
    call: ({ status }) => ({
      method: "GET",
      path: status ? `/posts?status=${status}` : "/posts",
    }),
    response: postListResponse,
  }),
  tool({
    name: "get_post",
    title: "Read a post",
    description: "Read one post, including its Markdown body.",
    input: postId,
    annotations: { readOnlyHint: true },
    call: ({ id }) => ({ method: "GET", path: `/posts/${id}` }),
    response: postResponse,
  }),
  tool({
    name: "create_draft",
    title: "Create a draft",
    description:
      "Create a draft post in Chinese (zh) or English (en) with a title, a Markdown body, and optional tags. The slug is generated from the title.",
    input: createPostRequest,
    call: (draft) => ({ method: "POST", path: "/posts", body: draft }),
    response: postResponse,
  }),
  tool({
    name: "update_post",
    title: "Edit a post",
    description:
      "Change a post's title, Markdown body, slug, or tags; only the fields given change, and given tags replace all of the post's tags. The slug can change only before the post's first publication.",
    input: postId.extend({ title, bodyMarkdown, slug, tags }),
    call: ({ id, ...fields }) => ({
      method: "PATCH",
      path: `/posts/${id}`,
      body: fields,
    }),
    response: postResponse,
  }),
  tool({
    name: "publish_post",
    title: "Publish a post",
    description: "Publish a post so that it appears on the public site.",
    input: postId,
    call: ({ id }) => ({
      method: "PATCH",
      path: `/posts/${id}`,
      body: { status: "published" },
    }),
    response: postResponse,
  }),
  tool({
    name: "unpublish_post",
    title: "Unpublish a post",
    description:
      "Return a published post to draft so that it no longer appears on the public site.",
    input: postId,
    call: ({ id }) => ({
      method: "PATCH",
      path: `/posts/${id}`,
      body: { status: "draft" },
    }),
    response: postResponse,
  }),
  tool({
    name: "delete_post",
    title: "Delete a post",
    description:
      "Move a post to the trash and off the public site. The owner can restore it from the admin's trash.",
    input: postId,
    annotations: { destructiveHint: true },
    call: ({ id }) => ({ method: "DELETE", path: `/posts/${id}` }),
  }),
];

// The low-level Server rather than McpServer: McpServer answers invalid
// arguments with a validation dump, and the owner should read plain sentences.
export function createBlogServer(config: BlogConfig): Server {
  const server = new Server(
    { name: "blog", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map(({ definition }) => definition),
  }));
  server.setRequestHandler(CallToolRequestSchema, ({ params }) => {
    const match = tools.find(
      ({ definition }) => definition.name === params.name,
    );
    if (!match) return failure(`The blog has no tool named ${params.name}.`);
    return match.run(params.arguments ?? {}, config);
  });
  return server;
}

function tool<A, R>(spec: ToolSpec<A, R>): BlogTool {
  const { name, title, description, input, annotations } = spec;
  return {
    definition: {
      name,
      title,
      description,
      inputSchema: z.toJSONSchema(input, {
        io: "input",
        target: "draft-7",
      }) as Tool["inputSchema"],
      annotations,
    },
    run: async (args, config) => {
      const parsed = input.safeParse(args, { reportInput: true });
      if (!parsed.success) return failure(describeArguments(parsed.error));
      return request(config, spec.call(parsed.data), spec.response);
    },
  };
}

const fieldNames: Record<string, string> = {
  id: "post id",
  bodyMarkdown: "Markdown body",
};

// Argument errors as sentences, such as "The title is missing."
function describeArguments(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      if (issue.code === "unrecognized_keys") {
        return `This tool does not take ${issue.keys.join(", ")}.`;
      }
      const key = issue.path.join(".");
      const field = `The ${fieldNames[key] ?? key}`;
      if (issue.code === "invalid_type" && issue.input === undefined) {
        return `${field} is missing.`;
      }
      if (issue.code === "invalid_value") {
        return `${field} must be ${issue.values.join(" or ")}.`;
      }
      return `${field} is not valid: ${issue.message}.`;
    })
    .join(" ");
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
