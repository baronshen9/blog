import { expect, test } from "vitest";
import { getDb } from "@/server/db";
import { createDraft, getPost, listPosts, updatePost } from ".";

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
