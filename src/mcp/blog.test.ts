import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, test, vi } from "vitest";
import type { PostResponse } from "../contract/index.ts";
import { type BlogConfig, createBlogServer } from "./blog.ts";

const url = "http://blog.test";
const id = "6f1c2a4e-8b1d-4c3e-9f2a-1b2c3d4e5f60";
const post: PostResponse = {
  id,
  language: "en",
  title: "Hello",
  slug: "hello",
  bodyMarkdown: "Hi",
  tags: [],
  status: "draft",
  publishedAt: null,
  updatedAt: "2026-10-27T00:00:00.000Z",
};

// A connected client whose server answers every API call with `answer`.
async function connect(
  answer: () => Promise<Response>,
  config: Partial<BlogConfig> = {},
) {
  const fetch = vi.fn<typeof globalThis.fetch>(answer);
  const server = createBlogServer({ url, token: "secret", fetch, ...config });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;
    const [content] = result.content;
    return {
      isError: result.isError ?? false,
      text: content?.type === "text" ? content.text : "",
    };
  };
  return { client, call, fetch };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));
const apiError = (status: number, code: string, message: string) => () =>
  json({ error: { code, message } }, status);

test("offers one tool per post action", async () => {
  const { client } = await connect(() => json({}));
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toEqual([
    "list_posts",
    "get_post",
    "create_draft",
    "update_post",
    "publish_post",
    "unpublish_post",
    "delete_post",
  ]);
});

test.each([
  ["list_posts", { status: "draft" }, "GET", "/posts?status=draft", undefined],
  ["list_posts", {}, "GET", "/posts", undefined],
  ["get_post", { id }, "GET", `/posts/${id}`, undefined],
  [
    "create_draft",
    { language: "en", title: "Hello", bodyMarkdown: "Hi" },
    "POST",
    "/posts",
    { language: "en", title: "Hello", bodyMarkdown: "Hi" },
  ],
  [
    "create_draft",
    { language: "en", title: "Hello", bodyMarkdown: "Hi", tags: ["Next JS"] },
    "POST",
    "/posts",
    { language: "en", title: "Hello", bodyMarkdown: "Hi", tags: ["Next JS"] },
  ],
  [
    "update_post",
    { id, title: "Hello again" },
    "PATCH",
    `/posts/${id}`,
    { title: "Hello again" },
  ],
  ["update_post", { id, tags: [] }, "PATCH", `/posts/${id}`, { tags: [] }],
  ["publish_post", { id }, "PATCH", `/posts/${id}`, { status: "published" }],
  ["unpublish_post", { id }, "PATCH", `/posts/${id}`, { status: "draft" }],
  ["delete_post", { id }, "DELETE", `/posts/${id}`, undefined],
])(
  "%s calls the API with the token",
  async (tool, args, method, path, body) => {
    const { call, fetch } = await connect(() =>
      tool === "delete_post"
        ? Promise.resolve(new Response(null, { status: 204 }))
        : json(tool === "list_posts" ? { posts: [] } : post),
    );
    const result = await call(tool, args);
    expect(result.isError).toBe(false);
    const [endpoint, init] = fetch.mock.calls[0] ?? [];
    expect(String(endpoint)).toBe(`${url}/api/v1${path}`);
    expect(init?.method).toBe(method);
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
    expect(init?.body && JSON.parse(String(init.body))).toEqual(body);
  },
);

test("returns the post as JSON and confirms a deletion", async () => {
  const read = await connect(() => json(post));
  expect(JSON.parse((await read.call("get_post", { id })).text)).toEqual(post);
  const deleted = await connect(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
  expect((await deleted.call("delete_post", { id })).text).toBe(
    "The post is in the trash now.",
  );
});

test.each([
  [
    "an invalid token",
    apiError(401, "UNAUTHORIZED", "A valid API token is required."),
    "The blog refused the API token. Check BLOG_API_TOKEN in this MCP server's configuration; if the token was revoked, create a new one in the admin under API tokens.",
  ],
  [
    "an unknown post",
    apiError(404, "NOT_FOUND", "This post does not exist."),
    "This post does not exist. Check the id with list_posts; deleted posts are in the admin's trash.",
  ],
  [
    "an empty title",
    apiError(400, "VALIDATION", "Enter a title."),
    "The blog did not accept the request: Enter a title.",
  ],
  [
    "an unexpected failure",
    apiError(500, "INTERNAL", "Something went wrong; try again."),
    "The blog failed while handling the request. Try again; if it keeps failing, check the blog's logs.",
  ],
  [
    "an unreachable blog",
    () => Promise.reject(new TypeError("fetch failed")),
    `The blog at ${url} cannot be reached. Start it (for example with docker compose up) and check BLOG_URL in this MCP server's configuration.`,
  ],
  [
    "a server that is not the blog",
    () => Promise.resolve(new Response("<html>", { status: 502 })),
    `The blog at ${url} answered with HTTP 502, which is not a response of the blog's API. Check that BLOG_URL points at the blog.`,
  ],
])("reports %s in plain language", async (_, answer, message) => {
  const { call } = await connect(answer);
  expect(await call("get_post", { id })).toEqual({
    isError: true,
    text: message,
  });
});

test("reports missing configuration without calling the blog", async () => {
  const { call, fetch } = await connect(() => json(post), { token: "" });
  expect(await call("get_post", { id })).toEqual({
    isError: true,
    text: "BLOG_API_TOKEN is not set. Add it to the environment of this MCP server in the assistant's configuration; see the blog's README.",
  });
  expect(fetch).not.toHaveBeenCalled();
});

test("reports invalid arguments in plain language without calling the blog", async () => {
  const { call, fetch } = await connect(() => json(post));
  expect(
    await call("create_draft", { language: "fr", bodyMarkdown: "Hi" }),
  ).toEqual({
    isError: true,
    text: "The language must be zh or en. The title is missing.",
  });
  expect(await call("get_post", { id: "42" })).toEqual({
    isError: true,
    text: "The post id is not valid: Invalid UUID.",
  });
  expect(fetch).not.toHaveBeenCalled();
});
