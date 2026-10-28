import { expect, test } from "@playwright/test";
import { marker, signIn } from "./owner";

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
