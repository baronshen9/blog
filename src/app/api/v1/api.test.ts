import sharp from "sharp";
import { expect, test } from "vitest";
import {
  errorResponse,
  imageLimitsResponse,
  imageResponse,
  postListResponse,
  postResponse,
} from "@/contract";
import { ensureOwner, signIn } from "@/server/auth";
import { maxImageBytes, readImage } from "@/server/media";
import {
  createDraft,
  getPost,
  getPublishedPost,
  listPosts,
  listTrashedPosts,
  restorePost,
} from "@/server/posts";
import { createToken, listTokens, revokeToken } from "@/server/tokens";
import { sessionCookie } from "@/app/admin/session-cookie";
import * as postsRoute from "./posts/route";
import * as postRoute from "./posts/[id]/route";
import * as translationsRoute from "./posts/[id]/translations/route";
import * as imagesRoute from "./images/route";
import * as imageLimitsRoute from "./images/limits/route";

type Options = { headers?: Record<string, string>; body?: unknown };

async function bearer(): Promise<Record<string, string>> {
  const { secret } = await createToken("Assistant");
  return { authorization: `Bearer ${secret}` };
}

function request(method: string, path: string, options: Options = {}) {
  const { headers = {}, body } = options;
  return new Request(`http://localhost/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body:
      body === undefined || typeof body === "string"
        ? body
        : JSON.stringify(body),
  });
}

const posts = {
  list: (query: string, options?: Options) =>
    postsRoute.GET(request("GET", `/posts${query}`, options)),
  create: (options: Options) =>
    postsRoute.POST(request("POST", "/posts", options)),
};
const translate = (id: string, options: Options) =>
  translationsRoute.POST(
    request("POST", `/posts/${id}/translations`, options),
    {
      params: Promise.resolve({ id }),
    },
  );
const uploadImage = (options: Options) =>
  imagesRoute.POST(request("POST", "/images", options));
const post = Object.fromEntries(
  (["GET", "PATCH", "DELETE"] as const).map((method) => [
    method,
    (id: string, options?: Options) =>
      postRoute[method](request(method, `/posts/${id}`, options), {
        params: Promise.resolve({ id }),
      }),
  ]),
) as Record<
  "GET" | "PATCH" | "DELETE",
  (id: string, options?: Options) => Promise<Response>
>;

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = errorResponse.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(body.error.message).not.toBe("");
  return body.error.message;
}

test("manages a post from draft to trash with a token", async () => {
  const headers = await bearer();

  const created = await posts.create({
    headers,
    body: { language: "en", title: "From an assistant", bodyMarkdown: "Hi" },
  });
  expect(created.status).toBe(201);
  const draft = postResponse.parse(await created.json());
  expect(draft).toMatchObject({
    slug: "from-an-assistant",
    status: "draft",
    publishedAt: null,
  });

  const renamed = await post.PATCH(draft.id, {
    headers,
    body: { slug: "assistant" },
  });
  expect(postResponse.parse(await renamed.json()).slug).toBe("assistant");

  const published = postResponse.parse(
    await (
      await post.PATCH(draft.id, { headers, body: { status: "published" } })
    ).json(),
  );
  expect(published.status).toBe("published");
  expect(published.publishedAt).not.toBeNull();
  await expect(getPublishedPost("en", "assistant")).resolves.toMatchObject({
    title: "From an assistant",
  });

  const edited = await post.PATCH(draft.id, {
    headers,
    body: { bodyMarkdown: "Edited", status: "draft" },
  });
  expect(postResponse.parse(await edited.json())).toMatchObject({
    title: "From an assistant",
    bodyMarkdown: "Edited",
    status: "draft",
    publishedAt: published.publishedAt,
  });

  const read = postResponse.parse(
    await (await post.GET(draft.id, { headers })).json(),
  );
  expect(read).toMatchObject({ id: draft.id, bodyMarkdown: "Edited" });

  const drafts = postListResponse.parse(
    await (await posts.list("?status=draft", { headers })).json(),
  );
  expect(drafts.posts.map(({ id }) => id)).toEqual([draft.id]);
  const publishedList = postListResponse.parse(
    await (await posts.list("?status=published", { headers })).json(),
  );
  expect(publishedList.posts).toEqual([]);

  const deleted = await post.DELETE(draft.id, { headers });
  expect(deleted.status).toBe(204);
  await expectError(await post.GET(draft.id, { headers }), 404, "NOT_FOUND");
  const all = postListResponse.parse(
    await (await posts.list("", { headers })).json(),
  );
  expect(all.posts).toEqual([]);
  expect((await listTrashedPosts()).map(({ id }) => id)).toEqual([draft.id]);
});

test("deleting only moves a post to the trash, also when repeated", async () => {
  const headers = await bearer();
  const { id } = await createDraft({
    language: "en",
    title: "Kept",
    bodyMarkdown: "",
  });

  expect((await post.DELETE(id, { headers })).status).toBe(204);
  await expectError(await post.DELETE(id, { headers }), 404, "NOT_FOUND");

  await restorePost(id);
  await expect(getPost(id)).resolves.toMatchObject({ title: "Kept" });
});

test.each([
  ["no Authorization header", async () => ({})],
  ["an unknown token", async () => ({ authorization: "Bearer unknown" })],
  [
    "a revoked token",
    async () => {
      const { token, secret } = await createToken("Revoked");
      await revokeToken(token.id);
      return { authorization: `Bearer ${secret}` };
    },
  ],
  [
    "a token in another scheme",
    async () => {
      const { secret } = await createToken("Basic");
      return { authorization: `Basic ${secret}` };
    },
  ],
  [
    "only the owner's session cookie",
    async () => {
      const owner = { username: "owner", password: "owner-password" };
      await ensureOwner(owner);
      const { token } = await signIn(owner);
      return { cookie: `${sessionCookie.name}=${token}` };
    },
  ],
])("refuses a request with %s and changes nothing", async (_, credentials) => {
  const headers = await credentials();
  const { id } = await createDraft({
    language: "en",
    title: "Untouched",
    bodyMarkdown: "",
  });

  const message = await expectError(
    await posts.create({
      headers,
      body: { language: "en", title: "Intruder", bodyMarkdown: "" },
    }),
    401,
    "UNAUTHORIZED",
  );
  expect(message).toBe("A valid API token is required.");
  await expectError(
    await post.PATCH(id, { headers, body: { status: "published" } }),
    401,
    "UNAUTHORIZED",
  );
  await expectError(await post.DELETE(id, { headers }), 401, "UNAUTHORIZED");
  await expectError(await posts.list("", { headers }), 401, "UNAUTHORIZED");
  await expectError(await post.GET(id, { headers }), 401, "UNAUTHORIZED");

  expect(await listPosts()).toMatchObject([{ id, status: "draft" }]);
  expect(await listTrashedPosts()).toEqual([]);
});

test("records when a token was last used", async () => {
  const { token, secret } = await createToken("Assistant");
  expect(token.lastUsedAt).toBeNull();

  await posts.list("", { headers: { authorization: `bearer ${secret}` } });

  const [used] = await listTokens();
  expect(used?.lastUsedAt).toBeInstanceOf(Date);
});

test.each([
  [
    "a blank title",
    () => ({ language: "en", title: " ", bodyMarkdown: "" }),
    "Enter a title.",
  ],
  ["a body that is not JSON", () => "{", "Send the request body as JSON."],
  [
    "an unknown language",
    () => ({ language: "fr", title: "x", bodyMarkdown: "" }),
    "language",
  ],
  [
    "an unknown field",
    () => ({ language: "en", title: "x", bodyMarkdown: "", deletedAt: null }),
    "deletedAt",
  ],
])("refuses creating a post with %s", async (_, body, message) => {
  const headers = await bearer();

  const error = await expectError(
    await posts.create({ headers, body: body() }),
    400,
    "VALIDATION",
  );

  expect(error).toContain(message);
  expect(await listPosts()).toEqual([]);
});

test("carries a post's tags, normalized by the posts service", async () => {
  const headers = await bearer();

  const created = postResponse.parse(
    await (
      await posts.create({
        headers,
        body: {
          language: "en",
          title: "Tagged",
          bodyMarkdown: "",
          tags: ["Next JS", "next_js", "数据库"],
        },
      })
    ).json(),
  );
  expect(created.tags).toEqual(["next-js", "数据库"]);

  const edited = await post.PATCH(created.id, {
    headers,
    body: { tags: ["Postgres"] },
  });
  expect(postResponse.parse(await edited.json()).tags).toEqual(["postgres"]);
  const read = await post.GET(created.id, { headers });
  expect(postResponse.parse(await read.json()).tags).toEqual(["postgres"]);

  const message = await expectError(
    await post.PATCH(created.id, { headers, body: { tags: ["c++"] } }),
    400,
    "VALIDATION",
  );
  expect(message).toContain('"c++"');
  await expectError(
    await post.PATCH(created.id, { headers, body: { tags: "postgres" } }),
    400,
    "VALIDATION",
  );
  await expect(getPost(created.id)).resolves.toMatchObject({
    tags: ["postgres"],
  });
});

test("explains invalid edits, unknown posts, and slug conflicts", async () => {
  const headers = await bearer();
  const content = { language: "en", bodyMarkdown: "" } as const;
  const { id } = await createDraft({ ...content, title: "Mine" });
  await createDraft({ ...content, title: "Taken" });

  await expectError(
    await post.PATCH(id, { headers, body: {} }),
    400,
    "VALIDATION",
  );
  await expectError(
    await post.PATCH(id, { headers, body: { slug: "Not A Slug" } }),
    400,
    "VALIDATION",
  );
  await expectError(
    await post.GET("not-a-uuid", { headers }),
    400,
    "VALIDATION",
  );
  await expectError(
    await posts.list("?status=trashed", { headers }),
    400,
    "VALIDATION",
  );
  await expectError(
    await post.GET(crypto.randomUUID(), { headers }),
    404,
    "NOT_FOUND",
  );
  const conflict = await expectError(
    await post.PATCH(id, { headers, body: { slug: "taken" } }),
    409,
    "CONFLICT",
  );
  expect(conflict).toContain('"taken"');
  await expect(getPost(id)).resolves.toMatchObject({ slug: "mine" });
});

test("creates a post's translation with a token and links both versions", async () => {
  const headers = await bearer();
  const source = await createDraft({
    language: "zh",
    title: "你好",
    bodyMarkdown: "嗨",
  });

  const created = await translate(source.id, {
    headers,
    body: { title: "Hello", bodyMarkdown: "Hi", tags: ["Greeting"] },
  });
  expect(created.status).toBe(201);
  const translation = postResponse.parse(await created.json());
  expect(translation).toMatchObject({
    language: "en",
    title: "Hello",
    slug: "hello",
    tags: ["greeting"],
    status: "draft",
    translation: {
      id: source.id,
      language: "zh",
      title: "你好",
      status: "draft",
      trashed: false,
    },
  });
  const read = postResponse.parse(
    await (await post.GET(source.id, { headers })).json(),
  );
  expect(read.translation).toEqual({
    id: translation.id,
    language: "en",
    title: "Hello",
    status: "draft",
    trashed: false,
  });

  const again = await expectError(
    await translate(source.id, {
      headers,
      body: { title: "Hello again", bodyMarkdown: "" },
    }),
    409,
    "CONFLICT",
  );
  expect(again).toContain("English version");
  await expectError(
    await translate(source.id, {
      headers,
      body: { language: "zh", title: "Hello", bodyMarkdown: "" },
    }),
    400,
    "VALIDATION",
  );
  await expectError(
    await translate(crypto.randomUUID(), {
      headers,
      body: { title: "Hello", bodyMarkdown: "" },
    }),
    404,
    "NOT_FOUND",
  );
  await expectError(
    await translate(source.id, {
      body: { title: "Hello", bodyMarkdown: "" },
    }),
    401,
    "UNAUTHORIZED",
  );
});

test("uploads an image with a token and answers its Markdown", async () => {
  const headers = await bearer();
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();

  const response = await uploadImage({
    headers,
    body: { alt: "A [blue] square", data: png.toString("base64") },
  });

  expect(response.status).toBe(201);
  const { path, markdown } = imageResponse.parse(await response.json());
  expect(path).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/);
  expect(markdown).toBe(`![A \\[blue\\] square](${path})`);
  const stored = await readImage(path.slice("/media/".length));
  expect(Buffer.from(stored.bytes)).toEqual(png);
});

test.each([
  [
    "a file that is not an image",
    { alt: "x", data: Buffer.from("not an image").toString("base64") },
    "This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
  ],
  [
    "a file above the size limit",
    { alt: "x", data: Buffer.alloc(5.5 * 1024 * 1024).toString("base64") },
    "This file is 5.5 MB; images can be at most 5 MB.",
  ],
  ["data that is not Base64", { alt: "x", data: "not base64!" }, "data"],
  ["no description", { data: "" }, "alt"],
])("refuses uploading %s", async (_, body, message) => {
  const headers = await bearer();

  const error = await expectError(
    await uploadImage({ headers, body }),
    400,
    "VALIDATION",
  );

  expect(error).toContain(message);
});

test("refuses an image upload by its declared length before reading it", async () => {
  const headers = await bearer();

  const error = await expectError(
    await uploadImage({
      headers: { ...headers, "content-length": String(100_000_000) },
      body: "{}",
    }),
    400,
    "VALIDATION",
  );

  expect(error).toBe("This file is 71.5 MB; images can be at most 5 MB.");
});

test("stops reading an image upload of undeclared length past the limit", async () => {
  const headers = await bearer();
  let pulled = 0;
  const endless = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });

  const error = await expectError(
    await imagesRoute.POST(
      new Request("http://localhost/api/v1/images", {
        method: "POST",
        headers,
        body: endless,
        duplex: "half",
      } as RequestInit),
    ),
    400,
    "VALIDATION",
  );

  expect(error).toContain("images can be at most 5 MB.");
  expect(pulled).toBeLessThan(12);
});

test("tells a client the image size limit", async () => {
  const response = await imageLimitsRoute.GET(
    request("GET", "/images/limits", { headers: await bearer() }),
  );

  expect(response.status).toBe(200);
  expect(imageLimitsResponse.parse(await response.json())).toEqual({
    maxBytes: maxImageBytes,
  });
  await expectError(
    await imageLimitsRoute.GET(request("GET", "/images/limits")),
    401,
    "UNAUTHORIZED",
  );
});

test("refuses an image upload without a token", async () => {
  await expectError(
    await uploadImage({ body: { alt: "x", data: "" } }),
    401,
    "UNAUTHORIZED",
  );
});
