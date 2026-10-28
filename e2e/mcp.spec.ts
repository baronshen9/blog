import { expect, test } from "@playwright/test";
import { postResponse } from "../src/contract/index.ts";
import { connectMcp, createToken, marker, signIn } from "./owner";

test("an assistant publishes a draft through the MCP server with the owner's token", async ({
  page,
  baseURL,
}) => {
  const title = `MCP smoke ${marker()}`;
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

test("an assistant translates a post through the MCP server", async ({
  page,
  baseURL,
}) => {
  const mark = marker();
  const title = `MCP source ${mark}`;
  const translatedTitle = `MCP 译文 ${mark}`;
  const main = page.getByRole("main");
  await signIn(page);
  const secret = await createToken(page, title);

  const { call, refusal, close } = await connectMcp(baseURL, secret);
  try {
    const source = postResponse.parse(
      JSON.parse(
        await call("create_draft", {
          language: "en",
          title,
          bodyMarkdown: "Written in English.",
        }),
      ),
    );
    await call("publish_post", { id: source.id });

    const translation = postResponse.parse(
      JSON.parse(
        await call("create_translation", {
          id: source.id,
          title: translatedTitle,
          bodyMarkdown: "通过 MCP 翻译。",
        }),
      ),
    );
    expect(translation).toMatchObject({ language: "zh", status: "draft" });
    expect(translation.translation?.id).toBe(source.id);
    const linked = postResponse.parse(
      JSON.parse(await call("get_post", { id: source.id })),
    );
    expect(linked.status).toBe("published");
    expect(linked.translation).toMatchObject({
      id: translation.id,
      status: "draft",
    });
    expect(
      await refusal("create_translation", {
        id: source.id,
        title: `Again ${mark}`,
        bodyMarkdown: "x",
      }),
    ).toContain("already has its Chinese version");

    // A draft translation is not linked from the published source.
    await page.goto(`/en/posts/${source.slug}`);
    await expect(main.getByRole("heading", { name: title })).toBeVisible();
    await expect(main.getByText("Also in Chinese:")).toHaveCount(0);

    await call("publish_post", { id: translation.id });
    await page.goto(`/en/posts/${source.slug}`);
    await expect(
      main.getByText(`Also in Chinese: ${translatedTitle}`),
    ).toBeVisible();
    await main.getByRole("link", { name: translatedTitle }).click();
    await expect(page).toHaveURL(`/zh/posts/${translation.slug}`);
    await expect(main.getByText(`另有英文版：${title}`)).toBeVisible();
  } finally {
    await close();
  }
});
