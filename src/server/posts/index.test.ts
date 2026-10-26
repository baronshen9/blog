import { expect, test } from "vitest";
import { getDb } from "@/server/db";
import {
  createDraft,
  getPost,
  getPublishedPost,
  listPosts,
  updatePost,
} from ".";

const draft = {
  language: "en",
  title: "  First post ",
  bodyMarkdown: "# Hello",
} as const;

test("creates a draft in its own translation group with a slug from the title", async () => {
  const post = await createDraft(draft);
  const other = await createDraft({ ...draft, language: "zh" });

  expect(post).toMatchObject({
    status: "draft",
    title: "First post",
    slug: "first-post",
    bodyMarkdown: "# Hello",
  });
  const groups = await getDb().post.findMany({
    select: { translationGroupId: true },
  });
  expect(new Set(groups.map((g) => g.translationGroupId)).size).toBe(2);
  expect(other.slug).toBe("first-post");
});

test("gives a taken slug a numeric suffix within a language", async () => {
  await createDraft(draft);
  const second = await createDraft(draft);
  const third = await createDraft({ ...draft, title: "First post!" });

  expect([second.slug, third.slug]).toEqual(["first-post-2", "first-post-3"]);
});

test("gives concurrent drafts with the same title distinct slugs", async () => {
  const posts = await Promise.all(
    Array.from({ length: 5 }, () => createDraft(draft)),
  );

  expect(posts.map((post) => post.slug).sort()).toEqual([
    "first-post",
    "first-post-2",
    "first-post-3",
    "first-post-4",
    "first-post-5",
  ]);
});

test("uses a short id as the slug of a title without Latin characters", async () => {
  const post = await createDraft({ ...draft, language: "zh", title: "你好" });

  expect(post.slug).toMatch(/^[0-9a-f]{8}$/);
});

test.each([
  ["creating", () => createDraft({ ...draft, title: "  " })],
  [
    "saving",
    async () =>
      updatePost((await createDraft(draft)).id, {
        title: "",
        bodyMarkdown: "",
      }),
  ],
])("refuses %s a post without a title", async (_, save) => {
  await expect(save()).rejects.toMatchObject({
    code: "VALIDATION",
    message: "Enter a title.",
  });
});

test("edits a draft's content and keeps its slug and status", async () => {
  const post = await createDraft(draft);

  await updatePost(post.id, { title: "Renamed", bodyMarkdown: "Body" });

  await expect(getPost(post.id)).resolves.toMatchObject({
    title: "Renamed",
    bodyMarkdown: "Body",
    slug: "first-post",
    status: "draft",
  });
});

test("lists posts outside the trash, most recently changed first", async () => {
  const older = await createDraft({ ...draft, title: "Older" });
  const newer = await createDraft({ ...draft, title: "Newer" });
  const trashed = await createDraft({ ...draft, title: "Trashed" });
  await getDb().post.update({
    where: { id: trashed.id },
    data: { deletedAt: new Date() },
  });
  await updatePost(older.id, { title: "Older", bodyMarkdown: "edited" });

  const titles = (await listPosts()).map((post) => post.title);

  expect(titles).toEqual(["Older", "Newer"]);
  await expect(getPost(trashed.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    updatePost(trashed.id, { title: "x", bodyMarkdown: "" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(newer.status).toBe("draft");
});

test("publishing makes a post public at its language and slug", async () => {
  const post = await createDraft(draft);
  await expect(getPublishedPost("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });

  const published = await updatePost(post.id, {
    title: "First post",
    bodyMarkdown: "Final",
    status: "published",
  });

  expect(published.publishedAt).toBeInstanceOf(Date);
  await expect(getPublishedPost("en", "first-post")).resolves.toEqual({
    language: "en",
    title: "First post",
    slug: "first-post",
    bodyMarkdown: "Final",
    publishedAt: published.publishedAt,
  });
  await expect(getPublishedPost("zh", "first-post")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("keeps the first publication date and the slug across unpublishing", async () => {
  const post = await createDraft(draft);
  const first = await updatePost(post.id, { ...draft, status: "published" });

  const unpublished = await updatePost(post.id, {
    title: "Renamed",
    bodyMarkdown: "",
    status: "draft",
  });
  await expect(getPublishedPost("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const again = await updatePost(post.id, { ...draft, status: "published" });

  expect(unpublished).toMatchObject({ status: "draft", slug: "first-post" });
  expect(unpublished.publishedAt).toEqual(first.publishedAt);
  expect(again.publishedAt).toEqual(first.publishedAt);
});

test("saving a published post changes its public content, not its status", async () => {
  const post = await createDraft(draft);
  await updatePost(post.id, { ...draft, status: "published" });

  await updatePost(post.id, { title: "Edited", bodyMarkdown: "New body" });

  await expect(getPublishedPost("en", post.slug)).resolves.toMatchObject({
    title: "Edited",
    bodyMarkdown: "New body",
  });
});

test("never shows a trashed post publicly", async () => {
  const post = await createDraft(draft);
  await updatePost(post.id, { ...draft, status: "published" });
  await getDb().post.update({
    where: { id: post.id },
    data: { deletedAt: new Date() },
  });

  await expect(getPublishedPost("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("concurrent saves never lose the first publication date", async () => {
  const posts = await Promise.all(
    Array.from({ length: 10 }, () => createDraft(draft)),
  );

  await Promise.all(
    posts.flatMap(({ id }) => [
      updatePost(id, { ...draft, status: "published" }),
      updatePost(id, draft),
      updatePost(id, { ...draft, status: "published" }),
    ]),
  );

  for (const { slug } of posts) {
    await expect(getPublishedPost("en", slug)).resolves.toMatchObject({
      slug,
    });
  }
});
