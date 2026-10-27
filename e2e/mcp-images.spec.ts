import { randomUUID } from "node:crypto";
import { mkdtemp, truncate, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
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

// A file far larger than the limit is refused from its size alone: the MCP
// server does not read it, and the API answers before receiving the body.
test("an oversized image is refused before it is read or received", async ({
  page,
  baseURL,
}) => {
  const marker = randomUUID().slice(0, 8);
  // A sparse file: 3 GB long without taking the space.
  const file = join(await mkdtemp(join(tmpdir(), "blog-smoke-")), "Huge.png");
  await writeFile(file, "");
  await truncate(file, 3 * 1024 ** 3);
  await signIn(page);
  const secret = await createToken(page, `Oversized image smoke ${marker}`);

  const { refusal, close } = await connectMcp(baseURL, secret);
  try {
    expect(await refusal("upload_image", { file })).toBe(
      "This file is 3072 MB; images can be at most 5 MB.",
    );
  } finally {
    await close();
  }

  // Declares a 3 GB body, sends 64 KB of it, and waits for the answer.
  const answer = await new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      const upload = httpRequest(
        new URL("/api/v1/images", baseURL),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json",
            "content-length": String(3 * 1024 ** 3),
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => (body += chunk));
          response.on("end", () => {
            resolve({ status: response.statusCode ?? 0, body });
            upload.destroy();
          });
        },
      );
      upload.on("error", reject);
      upload.write(`{"alt":"x","data":"${"A".repeat(64 * 1024)}`);
    },
  );
  expect(answer.status).toBe(400);
  expect(JSON.parse(answer.body)).toEqual({
    error: {
      code: "VALIDATION",
      message: "This file is 2304 MB; images can be at most 5 MB.",
    },
  });
});
