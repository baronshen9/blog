import { expect, test } from "@playwright/test";
import { createToken, marker, signIn } from "./owner";

test("the owner adds a translation that is drafted and published on its own", async ({
  page,
}) => {
  const stamp = marker();
  const title = `Translated smoke ${stamp}`;
  const translatedTitle = `翻译测试 ${stamp}`;
  const main = page.getByRole("main");
  await signIn(page);

  await main.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Language").selectOption("en");
  await page.getByLabel("Body (Markdown)").fill("Written in English.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const sourceUrl = page.url();

  await main.getByRole("link", { name: "Add Chinese translation" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/new\?translationOf=/);
  await expect(page.getByLabel("Language")).toHaveValue("zh");
  await expect(page.getByLabel("Language")).toBeDisabled();
  await expect(main.getByRole("link", { name: title })).toHaveAttribute(
    "href",
    new URL(sourceUrl).pathname,
  );
  await expect(page.getByLabel("Body (Markdown)")).toHaveValue(
    "Written in English.",
  );
  await page.getByLabel("Title", { exact: true }).fill(translatedTitle);
  await page.getByLabel("Body (Markdown)").fill("用中文写的。");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const slug = page.getByLabel("Slug");
  const translatedUrl = `/zh/posts/${await slug.inputValue()}`;

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByText("Status: Published")).toBeVisible();
  expect((await page.goto(translatedUrl))?.status()).toBe(200);

  await page.goto(sourceUrl);
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const link = main.getByRole("link", { name: translatedTitle });
  await expect(link).toBeVisible();
  await expect(main.getByText("Published", { exact: true })).toBeVisible();
  await expect(
    main.getByRole("link", { name: /Add .* translation/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect((await page.goto(translatedUrl))?.status()).toBe(200);
});

test("readers move between a post's published language versions", async ({
  page,
  request,
}) => {
  const stamp = marker();
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Translation link ${stamp}`)}`,
  };
  const created = await request.post("/api/v1/posts", {
    headers,
    data: { language: "en", title: `Linked ${stamp}`, bodyMarkdown: "Body" },
  });
  const source = await created.json();
  const added = await request.post(`/api/v1/posts/${source.id}/translations`, {
    headers,
    data: { title: `链接 ${stamp}`, bodyMarkdown: "正文" },
  });
  const translation = await added.json();
  const setStatus = (id: string, status: string) =>
    request.patch(`/api/v1/posts/${id}`, { headers, data: { status } });
  await setStatus(source.id, "published");

  const main = page.getByRole("main");
  const switchTo = (name: string) =>
    page
      .getByRole("navigation", { name: /^(Language|语言)$/ })
      .getByRole("link", { name });

  // A draft translation is neither linked nor the switch's target.
  await page.goto(`/en/posts/${source.slug}`);
  await expect(main.getByText(`Linked ${stamp}`)).toBeVisible();
  await expect(main.getByText("Also in Chinese:")).toHaveCount(0);
  await expect(switchTo("中文")).toHaveAttribute("href", "/zh");

  // Once published, each version links to the other, labeled in its page's
  // language, and the switch leads there too.
  await setStatus(translation.id, "published");
  await page.reload();
  await expect(main.getByText(`Also in Chinese: 链接 ${stamp}`)).toBeVisible();
  await main.getByRole("link", { name: `链接 ${stamp}` }).click();
  await expect(page).toHaveURL(`/zh/posts/${translation.slug}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(main.getByText(`另有英文版：Linked ${stamp}`)).toBeVisible();
  await switchTo("English").click();
  await expect(page).toHaveURL(`/en/posts/${source.slug}`);
  await expect(switchTo("中文")).toHaveAttribute(
    "href",
    `/zh/posts/${translation.slug}`,
  );

  // A trashed translation is no longer linked.
  await request.delete(`/api/v1/posts/${translation.id}`, { headers });
  await page.reload();
  await expect(main.getByText(`Linked ${stamp}`)).toBeVisible();
  await expect(main.getByText("Also in Chinese:")).toHaveCount(0);
  await expect(switchTo("中文")).toHaveAttribute("href", "/zh");
});
