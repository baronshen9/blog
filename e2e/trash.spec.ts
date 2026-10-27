import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

test("the owner trashes a published post, restores it as a draft, and deletes it for good", async ({
  page,
}) => {
  const stamp = Date.now();
  const title = `Trash smoke ${stamp}`;
  const url = `/en/posts/trash-smoke-${stamp}`;
  const main = page.getByRole("main");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await signIn(page);

  await main.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Language").selectOption("en");
  await page.getByLabel("Body (Markdown)").fill("Soon in the trash");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByText("Status: Published")).toBeVisible();
  const editor = page.url();

  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("row", { name: title })).toHaveCount(0);
  expect((await page.goto(url))?.status()).toBe(404);
  expect((await page.goto(editor))?.status()).toBe(404);

  await page.goto("/admin");
  await nav.getByRole("link", { name: "Trash" }).click();
  await expect(nav.getByRole("link", { name: "Trash" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const row = page.getByRole("row", { name: title });
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page).toHaveURL(editor);
  await expect(main.getByText("Status: Draft")).toBeVisible();
  expect((await page.goto(url))?.status()).toBe(404);

  await page.goto(editor);
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await nav.getByRole("link", { name: "Trash" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await row.getByRole("button", { name: "Delete permanently" }).click();
  await expect(row).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete permanently" }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row", { name: title })).toHaveCount(0);
});
