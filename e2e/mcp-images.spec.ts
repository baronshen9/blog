import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { imageResponse, postResponse } from "../src/contract/index.ts";
import { connectMcp, createToken, signIn } from "./owner";

// A 1×1 PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an assistant uploads a local image through the MCP server into a post that readers then see", async ({
  page,
  baseURL,
}) => {
  const title = `MCP images smoke ${Date.now()}`;
  const file = join(await mkdtemp(join(tmpdir(), "blog-smoke-")), "Chart.png");
  await writeFile(file, png);
  await signIn(page);
  const secret = await createToken(page, title);

  const { call, close } = await connectMcp(baseURL, secret);
  try {
    const { markdown } = imageResponse.parse(
      JSON.parse(await call("upload_image", { file })),
    );
    expect(markdown).toMatch(/^!\[Chart\]\(\/media\/[0-9a-f-]{36}\.png\)$/);
    const draft = postResponse.parse(
      JSON.parse(
        await call("create_draft", {
          language: "en",
          title,
          bodyMarkdown: "Before the chart.",
        }),
      ),
    );
    await call("update_post", {
      id: draft.id,
      bodyMarkdown: `Before the chart.\n\n${markdown}\n`,
    });
    await call("publish_post", { id: draft.id });

    await page.goto(`/en/posts/${draft.slug}`);
    const image = page.getByRole("article").getByRole("img", {
      name: "Chart",
    });
    await expect(image).toBeVisible();
    expect(
      await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(1);
    await call("delete_post", { id: draft.id });
  } finally {
    await close();
  }
});
