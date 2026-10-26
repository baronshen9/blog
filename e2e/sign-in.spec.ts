import { expect, test } from "@playwright/test";
import { password, username } from "./owner";

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
