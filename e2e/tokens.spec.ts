import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

test("the owner creates a token, sees its secret once, and revokes it", async ({
  page,
}) => {
  const name = `Smoke token ${Date.now()}`;
  const main = page.getByRole("main");
  await signIn(page);

  const tokensLink = page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Tokens" });
  await tokensLink.click();
  await expect(page).toHaveURL(/\/admin\/tokens$/);
  await expect(tokensLink).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Token name").fill(name);
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(main.getByRole("status")).toContainText(
    "it will not be shown again",
  );
  const secret = await page.getByLabel("Secret").inputValue();
  expect(secret).toMatch(/^[\w-]{43}$/);
  const row = main.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Never");
  await expect(page.getByLabel("Token name")).toHaveValue("");

  await page.reload();
  await expect(row).toBeVisible();
  await expect(page.getByLabel("Secret")).toHaveCount(0);
  expect(await page.content()).not.toContain(secret);

  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row).toContainText(/Revoked \d{4}-\d{2}-\d{2}/);
  await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);
});
