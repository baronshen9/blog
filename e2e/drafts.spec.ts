import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

test("the owner writes, previews, saves, and reopens a draft", async ({
  page,
}) => {
  const title = `Smoke post ${Date.now()}`;
  const main = page.getByRole("main");
  await signIn(page);

  await main.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Body (Markdown)").fill("Text without a title");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByRole("alert")).toHaveText("Enter a title.");
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);

  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Language").selectOption("zh");
  await page
    .getByLabel("Body (Markdown)")
    .fill("## Heading\n\n- item\n\n```js\nconst x = 1;\n```\n");
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("heading", { name: "Heading" })).toBeVisible();
  await expect(preview.getByRole("listitem")).toHaveText("item");
  await expect(
    preview.locator("pre.shiki span", { hasText: /^const$/ }),
  ).toHaveAttribute("style", /color:/);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("Language")).toHaveValue("zh");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  await expect(main.getByText("Status: Draft")).toBeVisible();
  await expect(page.getByLabel("Language")).toHaveValue("zh");
  await expect(page.getByLabel("Language")).toBeDisabled();

  await page.getByLabel("Body (Markdown)").fill("Edited body");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByRole("status")).toHaveText("Draft saved.");

  const posts = page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Posts", exact: true });
  await expect(posts).toHaveAttribute("aria-current", "page");
  await posts.click();
  const row = page.getByRole("row", { name: title });
  await expect(
    row.getByRole("cell", { name: "Draft", exact: true }),
  ).toBeVisible();
  await row.getByRole("link", { name: title }).click();
  await expect(page.getByLabel("Body (Markdown)")).toHaveValue("Edited body");
});
