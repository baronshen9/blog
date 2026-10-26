import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { expect, test } from "@playwright/test";

// scripts/smoke.sh starts the stack with .env.example, so its owner is ours.
const env = parseEnv(readFileSync(".env.example", "utf8"));
const username = env.OWNER_USERNAME ?? "";
const password = env.OWNER_PASSWORD ?? "";

test("only the signed-in owner reaches the admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Incorrect username or password.",
  );

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(`Signed in as ${username}.`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});
