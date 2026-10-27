import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

test("the owner sets a Chinese post's slug until its first publication", async ({
  page,
}) => {
  const slug = `slug-smoke-${Date.now()}`;
  const url = `/zh/posts/${slug}`;
  const main = page.getByRole("main");
  await signIn(page);

  await main.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Title", { exact: true }).fill("路径测试");
  await page.getByLabel("Language").selectOption("zh");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const field = page.getByLabel("Slug");
  await expect(field).toHaveValue(/^[0-9a-f]{8}$/);

  await field.fill("Not a slug");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByRole("alert")).toContainText("lowercase Latin");

  await field.fill(slug);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByRole("status")).toHaveText("Draft saved.");
  await page.reload();
  await expect(field).toHaveValue(slug);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByText("Status: Published")).toBeVisible();
  await expect(field).toHaveCount(0);
  await expect(main.getByText(url, { exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "View post" })).toHaveAttribute(
    "href",
    url,
  );
  expect((await page.goto(url))?.status()).toBe(200);

  await page.goBack();
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  await expect(field).toHaveCount(0);
  await expect(main.getByText(url, { exact: true })).toBeVisible();
});
