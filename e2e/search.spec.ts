import { expect, test } from "@playwright/test";
import { createToken, marker, signIn } from "./owner";

test("readers search published posts in Chinese and English from any page", async ({
  page,
  request,
}) => {
  const stamp = marker();
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Search smoke ${stamp}`)}`,
  };
  const create = async (
    language: string,
    title: string,
    bodyMarkdown: string,
    status = "published",
  ) => {
    const created = await request.post("/api/v1/posts", {
      headers,
      data: { language, title, bodyMarkdown },
    });
    const { id } = await created.json();
    await request.patch(`/api/v1/posts/${id}`, { headers, data: { status } });
  };
  await create("en", `Searchable ${stamp}`, `About Kubernetes${stamp} today`);
  await create("zh", `检索测试 ${stamp}`, `关于部署的笔记${stamp}号`);
  await create("en", `Hidden draft ${stamp}`, `kubernetes${stamp}`, "draft");

  const results = page.getByRole("main").getByRole("article");
  // The header's search box, in the language of the page it is on.
  const search = async (from: string, words: string) => {
    await page.goto(from);
    const box = page.getByRole("searchbox", {
      name: /^(Search posts|搜索文章)$/,
    });
    await box.fill(words);
    await page.getByRole("button", { name: /^(Search|搜索)$/ }).click();
    await expect(page).toHaveURL(/\/(en|zh)\/search\?q=/);
  };

  await search("/en", `KUBERNETES${stamp}`);
  await expect(results).toHaveCount(1);
  await expect(results.getByRole("link")).toHaveText(`Searchable ${stamp}`);

  await search("/zh/posts/missing", `部署的笔记${stamp}`);
  await expect(page).toHaveURL(/\/zh\/search\?q=/);
  await expect(results).toHaveCount(1);
  await expect(results.getByRole("link")).toHaveText(`检索测试 ${stamp}`);

  await search("/en", `nothing-matches-${stamp}`);
  await expect(results).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText(
    `No posts match “nothing-matches-${stamp}”.`,
  );

  await search("/en", "  ");
  await expect(page.getByRole("main")).toContainText(
    "Enter a word to search for.",
  );

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/en/search?q=${stamp}`);
  await expect(results).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
