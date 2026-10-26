import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./owner";

async function expectNotFound(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
}

test("the owner publishes a draft that readers open until it is unpublished", async ({
  page,
}) => {
  const stamp = Date.now();
  const title = `Published smoke ${stamp}`;
  const url = `/en/posts/published-smoke-${stamp}`;
  const main = page.getByRole("main");
  await signIn(page);

  await page.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Language").selectOption("en");
  await page
    .getByLabel("Body (Markdown)")
    .fill("Intro text\n\n```js\nconst x = 1;\n```\n");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const editor = page.url();
  await expectNotFound(page, url);

  await page.goto(editor);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByRole("status")).toHaveText("Published.");
  await expect(main.getByText("Status: Published")).toBeVisible();
  await expect(main.getByRole("link", { name: "View post" })).toHaveAttribute(
    "href",
    url,
  );

  await page.goto(url);
  const article = page.getByRole("article");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(article.locator("time")).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(article.getByText("Intro text")).toBeVisible();
  await expect(
    article.locator("pre.shiki span", { hasText: /^const$/ }),
  ).toHaveAttribute("style", /color:/);

  await page.goto(editor);
  await page.getByLabel("Body (Markdown)").fill("Edited after publishing");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(main.getByRole("status")).toHaveText(
    "Saved and updated on the site.",
  );
  await page.goto(url);
  await expect(page.getByRole("article")).toContainText(
    "Edited after publishing",
  );

  await page.goto(editor);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  await expectNotFound(page, url);
});

test("an unknown post URL is not found", async ({ page }) => {
  await expectNotFound(page, `/zh/posts/missing-${Date.now()}`);
});
