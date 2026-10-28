import { expect, test } from "@playwright/test";
import { createToken, marker, signIn } from "./owner";

test("readers switch the interface between Chinese and English", async ({
  page,
  request,
}) => {
  const mark = marker();
  const tag = `lang-${mark}`;
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Language smoke ${mark}`)}`,
  };
  const publish = async (language: string, title: string) => {
    const created = await request.post("/api/v1/posts", {
      headers,
      data: { language, title, bodyMarkdown: "Body", tags: [tag] },
    });
    const { id, slug } = await created.json();
    await request.patch(`/api/v1/posts/${id}`, {
      headers,
      data: { status: "published" },
    });
    return slug as string;
  };
  await publish("en", `English ${mark}`);
  const chinese = await publish("zh", `中文 ${mark}`);

  const main = page.getByRole("main");
  const heading = main.getByRole("heading", { level: 1 });
  const switchTo = (name: string) =>
    page
      .getByRole("navigation", { name: /^(Language|语言)$/ })
      .getByRole("link", { name });

  // A search keeps its words in the other language, and the page's links
  // keep the language chosen.
  await page.goto(`/en/search?q=${mark}`);
  await expect(heading).toHaveText("Search");
  await switchTo("中文").click();
  await expect(page).toHaveURL(`/zh/search?q=${mark}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(heading).toHaveText("搜索");
  await expect(main.getByText(`包含“${mark}”的文章`)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "搜索文章" })).toBeVisible();
  const card = main.getByRole("article").filter({ hasText: `English ${mark}` });
  await card.getByRole("list", { name: "标签" }).getByRole("link").click();
  await expect(page).toHaveURL(`/zh/tags/${tag}`);
  await expect(main.getByText(`标签为“${tag}”的文章`)).toBeVisible();

  // A tag page leads to the same tag in the other language.
  await switchTo("English").click();
  await expect(page).toHaveURL(`/en/tags/${tag}`);
  await expect(main.getByText(`Posts tagged “${tag}”`)).toBeVisible();

  // A post has no equivalent in the other language yet: its home page.
  await page.goto(`/zh/posts/${chinese}`);
  const form = page.getByRole("region", { name: "发表评论" });
  await form.getByLabel("昵称").fill(`Reader ${mark}`);
  await form.getByLabel("留言").fill("   ");
  await form.getByRole("button", { name: "发送评论" }).click();
  await expect(form.getByRole("alert")).toHaveText("请输入留言。");
  await switchTo("English").click();
  await expect(page).toHaveURL("/en");
  await expect(heading).toHaveText("Posts");

  // The not-found page speaks the language of its URL and leads back to it.
  const response = await page.goto(`/zh/missing-${mark}`);
  expect(response?.status()).toBe(404);
  await expect(heading).toHaveText("页面不存在");
  await expect(main.getByRole("link", { name: "全部文章" })).toHaveAttribute(
    "href",
    "/zh",
  );
  await expect(switchTo("English")).toHaveAttribute("href", "/en");

  // At phone width the switch and the search box both fit the header.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/zh");
  await expect(heading).toHaveText("文章");
  await expect(switchTo("English")).toBeInViewport();
  await expect(
    page.getByRole("searchbox", { name: "搜索文章" }),
  ).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
