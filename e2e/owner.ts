import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { expect, type Page } from "@playwright/test";

// scripts/smoke.sh starts the stack with .env.example, so its owner is ours.
const env = parseEnv(readFileSync(".env.example", "utf8"));
export const username = env.OWNER_USERNAME ?? "";
export const password = env.OWNER_PASSWORD ?? "";

export async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
