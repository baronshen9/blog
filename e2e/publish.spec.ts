import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./owner";

async function expectNotFound(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
}

// The home page that / leads to with .env.example's SITE_DEFAULT_LANGUAGE.
async function homeEntry(page: Page, title: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  return page.getByRole("article").filter({
    has: page.getByRole("heading", { name: title }),
  });
}

// A phone-width page shows its content without sideways scrolling.
async function expectFitsPhone(page: Page, url: string) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(url);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /width=device-width/,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("the owner publishes a draft that readers open until it is unpublished", async ({
  page,
}) => {
  const stamp = Date.now();
  const title = `Published smoke ${stamp}`;
  const url = `/en/posts/published-smoke-${stamp}`;
  const main = page.getByRole("main");
  await signIn(page);

  await main.getByRole("link", { name: "New post" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Language").selectOption("en");
  await page
    .getByLabel("Body (Markdown)")
    .fill(
      `Intro text https://example.com/${"x".repeat(120)}\n\n` +
        `\`\`\`js\nconst x = 1; // ${"wide ".repeat(40)}\n\`\`\`\n`,
    );
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  const editor = page.url();
  await expectNotFound(page, url);
  await expect(await homeEntry(page, title)).toHaveCount(0);

  await page.goto(editor);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByRole("status")).toHaveText("Published.");
  await expect(main.getByText("Status: Published")).toBeVisible();
  await expect(main.getByRole("link", { name: "View post" })).toHaveAttribute(
    "href",
    url,
  );

  const entry = await homeEntry(page, title);
  await expect(page.getByRole("article").first()).toHaveText(new RegExp(title));
  await expect(entry.locator("time")).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(entry).toContainText("Intro text https://example.com/");
  await expect(entry).not.toContainText("const x");
  await expectFitsPhone(page, "/en");
  await expectFitsPhone(page, url);

  await page.goto("/en");
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(url);
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
  await expect(await homeEntry(page, title)).toHaveCount(0);
});

test("an unknown post, page, or language URL is not found", async ({
  page,
}) => {
  await expectNotFound(page, `/zh/posts/missing-${Date.now()}`);
  await expectNotFound(page, "/en/no/such/page");
  await expectNotFound(page, "/fr");
  await expectNotFound(page, "/fr/posts/anything");
});
