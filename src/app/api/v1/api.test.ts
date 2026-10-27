import { expect, test } from "vitest";
import { errorResponse, postListResponse, postResponse } from "@/contract";
import { ensureOwner, signIn } from "@/server/auth";
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
