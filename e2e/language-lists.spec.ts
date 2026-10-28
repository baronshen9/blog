import { expect, test } from "@playwright/test";
import { createToken, homeCard, marker, signIn } from "./owner";

test("lists show each translation group once, in the selected language when published", async ({
  page,
  request,
}) => {
  const mark = marker();
  const tag = `lists-${mark}`;
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Lists smoke ${mark}`)}`,
  };
  const publish = async (path: string, data: Record<string, unknown>) => {
    const created = await request.post(path, {
      headers,
      data: { bodyMarkdown: `Body ${mark}`, tags: [tag], ...data },
    });
    expect(created.status()).toBe(201);
    const { id, slug } = await created.json();
    const published = await request.patch(`/api/v1/posts/${id}`, {
      headers,
      data: { status: "published" },
    });
    expect(published.ok()).toBe(true);
    return { id: id as string, slug: slug as string };
  };
  const both = await publish("/api/v1/posts", {
    language: "en",
    title: `Both English ${mark}`,
  });
  await publish(`/api/v1/posts/${both.id}/translations`, {
    title: `两种中文 ${mark}`,
  });
  const chineseOnly = await publish("/api/v1/posts", {
    language: "zh",
    title: `只有中文 ${mark}`,
  });

  const main = page.getByRole("main");
  const titles = main.getByRole("article").getByRole("heading");
  const card = (title: string) =>
    main.getByRole("article").filter({ hasText: title });

  // Search and tag pages show the version in the page's language, and a post
  // that exists only in the other language with its label.
  for (const path of [`/en/search?q=${mark}`, `/en/tags/${tag}`]) {
    await page.goto(path);
    await expect(titles).toHaveText([
      `只有中文 ${mark}`,
      `Both English ${mark}`,
    ]);
    await expect(
      card(`只有中文 ${mark}`).getByText("中文", { exact: true }),
    ).toBeVisible();
  }
  for (const path of [`/zh/search?q=${mark}`, `/zh/tags/${tag}`]) {
    await page.goto(path);
    await expect(titles).toHaveText([`只有中文 ${mark}`, `两种中文 ${mark}`]);
  }

  // The home page lists the post that exists only in Chinese, which opens at
  // its own URL in Chinese.
  const home = await homeCard(page, `只有中文 ${mark}`);
  await home.getByRole("link", { name: `只有中文 ${mark}` }).click();
  await expect(page).toHaveURL(`/zh/posts/${chineseOnly.slug}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
});
