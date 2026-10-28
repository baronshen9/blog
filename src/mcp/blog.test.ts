import {
  type FileHandle,
  mkdtemp,
  open,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  translation: null,
};

// A connected client whose server answers every API call with `answer`.
async function connect(
  answer: (input: string | URL | Request) => Promise<Response>,
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

test("offers one tool per post action and an image upload", async () => {
  const { client } = await connect(() => json({}));
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toEqual([
    "list_posts",
    "get_post",
    "create_draft",
    "create_translation",
    "update_post",
    "publish_post",
    "unpublish_post",
    "delete_post",
    "upload_image",
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
    "create_translation",
    { id, title: "你好", bodyMarkdown: "嗨", tags: ["greeting"] },
    "POST",
    `/posts/${id}/translations`,
    { title: "你好", bodyMarkdown: "嗨", tags: ["greeting"] },
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

// A file in a fresh temporary folder, and that folder.
async function localFile(name: string, bytes: Uint8Array) {
  const dir = await mkdtemp(join(tmpdir(), "blog-mcp-"));
  const file = join(dir, name);
  await writeFile(file, bytes);
  return { dir, file };
}

const uploaded = {
  path: "/media/6f1c2a4e-8b1d-4c3e-9f2a-1b2c3d4e5f60.png",
  markdown: "![Figure 1](/media/6f1c2a4e-8b1d-4c3e-9f2a-1b2c3d4e5f60.png)",
};

// The blog's image API: the size limit, after `beforeLimit` runs, and
// `upload` for the upload itself.
const imageApi =
  (
    upload: () => Promise<Response>,
    beforeLimit: () => Promise<void> = async () => {},
  ) =>
  async (input: string | URL | Request) =>
    String(input).endsWith("/api/v1/images/limits")
      ? (await beforeLimit(), json({ maxBytes: 5 * 1024 * 1024 }))
      : upload();

test.each([
  ["the file's name", {}, "Figure 1"],
  ["the given description", { alt: "A chart" }, "A chart"],
])(
  "upload_image sends a local file described by %s and returns its Markdown",
  async (_, args, alt) => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const { file } = await localFile("Figure 1.png", bytes);
    const { call, fetch } = await connect(imageApi(() => json(uploaded, 201)));

    const result = await call("upload_image", { file, ...args });

    expect(result).toEqual({
      isError: false,
      text: JSON.stringify(uploaded, null, 2),
    });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `${url}/api/v1/images/limits`,
    );
    const [endpoint, init] = fetch.mock.calls[1] ?? [];
    expect(String(endpoint)).toBe(`${url}/api/v1/images`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      alt,
      data: Buffer.from(bytes).toString("base64"),
    });
  },
);

test("upload_image reports a file the blog refuses in plain language", async () => {
  const { file } = await localFile("notes.txt", new Uint8Array([1, 2, 3]));
  const { call } = await connect(
    imageApi(
      apiError(
        400,
        "VALIDATION",
        "This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
      ),
    ),
  );
  expect(await call("upload_image", { file })).toEqual({
    isError: true,
    text: "The blog did not accept the request: This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
  });
});

test("upload_image refuses a file over the blog's limit from its size, without sending it", async () => {
  // A sparse file: 3 GB long without taking the space or being read.
  const { file } = await localFile("huge.png", new Uint8Array());
  await truncate(file, 3 * 1024 ** 3);
  const { call, fetch } = await connect(imageApi(() => json(uploaded, 201)));

  expect(await call("upload_image", { file })).toEqual({
    isError: true,
    text: "This file is 3072 MB; images can be at most 5 MB.",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("upload_image never reads past the limit when the file grows after its size check", async () => {
  const { file } = await localFile("growing.png", new Uint8Array([1, 2, 3]));
  const { call, fetch } = await connect(
    imageApi(
      () => json(uploaded, 201),
      async () => {
        // The file grows past the limit between the size check and the read;
        // sparse, so the test takes no space.
        await truncate(file, 6 * 1024 * 1024);
      },
    ),
  );

  expect(await call("upload_image", { file })).toEqual({
    isError: true,
    text: "This file is over 5 MB; images can be at most 5 MB.",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("upload_image closes the file when checking it fails", async () => {
  const { file } = await localFile("figure.png", new Uint8Array([1]));
  const probe = await open(file);
  const handles: FileHandle = Object.getPrototypeOf(probe);
  await probe.close();
  const checked: FileHandle[] = [];
  const stat = vi.spyOn(handles, "stat").mockImplementationOnce(function (
    this: FileHandle,
  ) {
    checked.push(this);
    return Promise.reject(
      Object.assign(new Error("injected failure"), { code: "EIO" }),
    );
  });
  const { call, fetch } = await connect(() => json(uploaded, 201));

  try {
    expect(await call("upload_image", { file })).toEqual({
      isError: true,
      text: `The file at ${file} cannot be read: injected failure`,
    });
    // A closed handle has no file descriptor.
    expect(checked.map((handle) => handle.fd)).toEqual([-1]);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    stat.mockRestore();
  }
});

test("upload_image reports a local file it cannot read without calling the blog", async () => {
  const { dir } = await localFile("other.png", new Uint8Array([1]));
  const missing = join(dir, "missing.png");
  const { call, fetch } = await connect(() => json(uploaded, 201));

  expect(await call("upload_image", { file: missing })).toEqual({
    isError: true,
    text: `There is no file at ${missing}. Check the path of the image file on this machine.`,
  });
  expect(await call("upload_image", { file: dir })).toEqual({
    isError: true,
    text: `${dir} is a folder. Give the path of an image file.`,
  });
  expect(await call("upload_image", { file: "/dev/null" })).toEqual({
    isError: true,
    text: "/dev/null is not a regular file. Give the path of an image file.",
  });
  expect(await call("upload_image", { file: "figure.png" })).toEqual({
    isError: true,
    text: '"figure.png" is not an absolute path. Give the full path of the image file on this machine.',
  });
  expect(await call("upload_image", {})).toEqual({
    isError: true,
    text: "The file path is missing.",
  });
  expect(fetch).not.toHaveBeenCalled();
});
