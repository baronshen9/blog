import { expect, test } from "@playwright/test";
import { postResponse } from "../src/contract/index.ts";
import { connectMcp, createToken, signIn } from "./owner";

test("an assistant publishes a draft through the MCP server with the owner's token", async ({
  page,
  baseURL,
}) => {
  const title = `MCP smoke ${Date.now()}`;
  await signIn(page);
  const secret = await createToken(page, title);

  const { call, close } = await connectMcp(baseURL, secret);
  try {
    const draft = postResponse.parse(
      JSON.parse(
        await call("create_draft", {
          language: "en",
          title,
          bodyMarkdown: "Written *through MCP*.",
        }),
      ),
    );
    expect((await page.goto(`/en/posts/${draft.slug}`))?.status()).toBe(404);
    await page.goto(`/admin/posts/${draft.id}`);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
    await expect(
      page.getByRole("main").getByText("Status: Draft"),
    ).toBeVisible();

    const published = postResponse.parse(
      JSON.parse(await call("publish_post", { id: draft.id })),
    );
    expect(published.status).toBe("published");
    await page.goto(`/en/posts/${draft.slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("em", { hasText: "through MCP" })).toBeVisible();

    await call("delete_post", { id: draft.id });
    expect((await page.goto(`/en/posts/${draft.slug}`))?.status()).toBe(404);
  } finally {
    await close();
  }
});
