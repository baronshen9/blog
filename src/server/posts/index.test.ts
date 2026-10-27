import { expect, test } from "vitest";
import { getDb } from "@/server/db";
import {
  createDraft,
  deletePostPermanently,
  getPost,
  getPublishedPost,
  listPosts,
  listPublishedPosts,
  listTrashedPosts,
  publishedPageSize,
  restorePost,
  trashPost,
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

test("changes only the fields given", async () => {
  const post = await createDraft(draft);

  await updatePost(post.id, { bodyMarkdown: "Body" });
  await updatePost(post.id, { title: " Renamed " });
  await updatePost(post.id, { status: "published" });

  await expect(getPost(post.id)).resolves.toMatchObject({
    title: "Renamed",
    bodyMarkdown: "Body",
    slug: "first-post",
    status: "published",
  });
});

test("normalizes tags and keeps spellings that normalize alike as one tag", async () => {
  const post = await createDraft({
    ...draft,
    tags: ["TypeScript", " typescript ", "Next JS", "next_js", " ", "数据库"],
  });
  expect(post.tags).toEqual(["typescript", "next-js", "数据库"]);

  await updatePost(post.id, { title: "Renamed" });
  await expect(getPost(post.id)).resolves.toMatchObject({
    tags: ["typescript", "next-js", "数据库"],
  });

  await updatePost(post.id, { tags: ["Postgres", "TYPESCRIPT"] });
  await expect(getPost(post.id)).resolves.toMatchObject({
    tags: ["postgres", "typescript"],
  });
  await updatePost(post.id, { tags: [] });
  await expect(getPost(post.id)).resolves.toMatchObject({ tags: [] });
  await expect(createDraft(draft)).resolves.toMatchObject({ tags: [] });
});

test.each([
  ["creating", () => createDraft({ ...draft, tags: ["ok", "c++"] })],
  [
    "saving",
    async () =>
      updatePost((await createDraft(draft)).id, { tags: ["ok", "a/b"] }),
  ],
  [
    "saving a long tag",
    async () =>
      updatePost((await createDraft(draft)).id, { tags: ["a".repeat(41)] }),
  ],
])("refuses %s a post with an invalid tag", async (_, save) => {
  await expect(save()).rejects.toMatchObject({
    code: "VALIDATION",
    message: expect.stringContaining("letters, digits, and single hyphens"),
  });
  const saved = await getDb().post.findMany({ select: { tags: true } });
  expect(saved.flatMap(({ tags }) => tags)).toEqual([]);
});

test("changes a never-published post's slug", async () => {
  const post = await createDraft({ ...draft, language: "zh", title: "你好" });

  const saved = await updatePost(post.id, {
    ...draft,
    slug: " hello-world ",
    status: "published",
  });

  expect(saved).toMatchObject({ slug: "hello-world", status: "published" });
  await expect(getPublishedPost("zh", "hello-world")).resolves.toMatchObject({
    slug: "hello-world",
  });
});

test("accepts a generated slug longer than a title's slug, unchanged", async () => {
  const long = { ...draft, title: "a".repeat(80) };
  await createDraft(long);
  const post = await createDraft(long);

  const saved = await updatePost(post.id, {
    ...long,
    slug: post.slug,
    status: "published",
  });
  await expect(
    updatePost(post.id, { ...long, slug: post.slug }),
  ).resolves.toMatchObject({ slug: `${"a".repeat(80)}-2` });
  expect(saved.status).toBe("published");
});

test.each(["", "Hello", "hello--world", "-hello", "hello_world", "你好"])(
  "refuses the invalid slug %j",
  async (slug) => {
    const post = await createDraft(draft);

    await expect(updatePost(post.id, { ...draft, slug })).rejects.toMatchObject(
      { code: "VALIDATION" },
    );
    await expect(getPost(post.id)).resolves.toMatchObject({
      slug: "first-post",
    });
  },
);

test("refuses a slug taken in the post's language, trashed posts included", async () => {
  const taken = await createDraft({ ...draft, title: "Taken" });
  await trashPost(taken.id);
  const post = await createDraft(draft);
  const other = await createDraft({ ...draft, language: "zh" });

  await expect(
    updatePost(post.id, { ...draft, slug: "taken" }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
    message: expect.stringContaining('"taken"'),
  });
  await expect(
    updatePost(other.id, { ...draft, slug: "taken" }),
  ).resolves.toMatchObject({ slug: "taken" });
});

test("keeps the slug fixed after the first publication, also when unpublished", async () => {
  const post = await createDraft(draft);
  await updatePost(post.id, { ...draft, status: "published" });
  await updatePost(post.id, { ...draft, status: "draft" });

  await expect(
    updatePost(post.id, { ...draft, slug: "renamed" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    updatePost(post.id, { ...draft, title: "Same slug", slug: "first-post" }),
  ).resolves.toMatchObject({ title: "Same slug", slug: "first-post" });
});

test("a slug change racing the first publication never moves a published URL", async () => {
  const posts = await Promise.all(
    Array.from({ length: 10 }, () => createDraft(draft)),
  );

  const published = await Promise.all(
    posts.map(({ id }, n) => {
      const move = updatePost(id, { ...draft, slug: `moved-${n}` });
      return Promise.all([
        updatePost(id, { ...draft, status: "published" }),
        move.catch(() => undefined),
      ]).then(([post]) => post);
    }),
  );

  for (const { id, slug } of published) {
    await expect(getPost(id)).resolves.toMatchObject({ slug });
  }
});

test("lists posts outside the trash, most recently changed first", async () => {
  const older = await createDraft({ ...draft, title: "Older" });
  const newer = await createDraft({ ...draft, title: "Newer" });
  const trashed = await createDraft({ ...draft, title: "Trashed" });
  await trashPost(trashed.id);
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

test("lists only the posts with the given status", async () => {
  const published = await createDraft({ ...draft, title: "Published" });
  await updatePost(published.id, { status: "published" });
  const trashed = await createDraft({ ...draft, title: "Trashed" });
  await updatePost(trashed.id, { status: "published" });
  await trashPost(trashed.id);
  await createDraft({ ...draft, title: "Draft" });

  const titles = async (status: "draft" | "published") =>
    (await listPosts(status)).map((post) => post.title);

  expect(await titles("published")).toEqual(["Published"]);
  expect(await titles("draft")).toEqual(["Draft"]);
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
  await trashPost(post.id);

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

// Publishes a new post and backdates its first publication to `day`.
async function publishOn(
  day: number,
  content: Parameters<typeof createDraft>[0] = draft,
) {
  const post = await createDraft(content);
  await updatePost(post.id, { ...content, status: "published" });
  const publishedAt = new Date(Date.UTC(2026, 0, day));
  await getDb().post.update({ where: { id: post.id }, data: { publishedAt } });
  return post;
}

test("lists published posts newest first with an excerpt, in every language", async () => {
  await publishOn(1, { ...draft, title: "Old", bodyMarkdown: "Old **body**" });
  await publishOn(3, { ...draft, title: "新", language: "zh" });
  await publishOn(2, { ...draft, title: "Middle" });

  const { posts, page, pageCount } = await listPublishedPosts(1);

  expect({ page, pageCount }).toEqual({ page: 1, pageCount: 1 });
  expect(posts.map((post) => [post.language, post.title])).toEqual([
    ["zh", "新"],
    ["en", "Middle"],
    ["en", "Old"],
  ]);
  expect(posts[2]).toEqual({
    language: "en",
    title: "Old",
    slug: "old",
    publishedAt: new Date(Date.UTC(2026, 0, 1)),
    excerpt: "Old body",
  });
});

test("never lists drafts, unpublished, or trashed posts", async () => {
  await createDraft({ ...draft, title: "Draft" });
  const unpublished = await publishOn(1, { ...draft, title: "Unpublished" });
  await updatePost(unpublished.id, { ...draft, status: "draft" });
  const trashed = await publishOn(2, { ...draft, title: "Trashed" });
  await trashPost(trashed.id);

  await expect(listPublishedPosts(1)).resolves.toEqual({
    posts: [],
    page: 1,
    pageCount: 1,
  });
});

test("pages through a long list and refuses pages that do not exist", async () => {
  for (let day = 1; day <= publishedPageSize + 1; day++) {
    await publishOn(day, { ...draft, title: `Day ${day}` });
  }

  const first = await listPublishedPosts(1);
  const second = await listPublishedPosts(2);

  expect(first.posts).toHaveLength(publishedPageSize);
  expect(first.posts[0]?.title).toBe(`Day ${publishedPageSize + 1}`);
  expect(second).toMatchObject({ page: 2, pageCount: 2 });
  expect(second.posts.map((post) => post.title)).toEqual(["Day 1"]);
  for (const page of [0, 3, 1.5, Number.NaN]) {
    await expect(listPublishedPosts(page)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  }
});

test("lists trashed posts, most recently trashed first", async () => {
  const first = await createDraft({ ...draft, title: "First" });
  const second = await createDraft({ ...draft, title: "Second" });
  await createDraft({ ...draft, title: "Kept" });
  for (const [day, { id }] of [first, second].entries()) {
    await trashPost(id);
    const deletedAt = new Date(Date.UTC(2026, 0, day + 1));
    await getDb().post.update({ where: { id }, data: { deletedAt } });
  }

  const trashed = await listTrashedPosts();

  expect(trashed.map((post) => post.title)).toEqual(["Second", "First"]);
  expect(trashed[0]).toEqual({
    id: second.id,
    language: "en",
    title: "Second",
    trashedAt: new Date(Date.UTC(2026, 0, 2)),
  });
});

test("restores a trashed published post as a draft with its slug and first publication", async () => {
  const post = await createDraft(draft);
  const published = await updatePost(post.id, {
    ...draft,
    status: "published",
  });
  await trashPost(post.id);

  await restorePost(post.id);

  await expect(getPost(post.id)).resolves.toMatchObject({
    status: "draft",
    slug: "first-post",
    publishedAt: published.publishedAt,
  });
  await expect(listTrashedPosts()).resolves.toEqual([]);
  await expect(getPublishedPost("en", post.slug)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("deletes only trashed posts permanently", async () => {
  const live = await createDraft({ ...draft, title: "Live" });
  const trashed = await createDraft({ ...draft, title: "Trashed" });
  await trashPost(trashed.id);

  await expect(deletePostPermanently(live.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await deletePostPermanently(trashed.id);

  await expect(getDb().post.count()).resolves.toBe(1);
  await expect(getPost(live.id)).resolves.toMatchObject({ title: "Live" });
});

test.each([
  ["trashing a trashed post", trashPost, true],
  ["restoring a post outside the trash", restorePost, false],
])("refuses %s", async (_, change, trashed) => {
  const post = await createDraft(draft);
  if (trashed) await trashPost(post.id);

  await expect(change(post.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
