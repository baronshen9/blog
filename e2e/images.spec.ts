import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

// A 1×1 PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("the owner uploads an image into a post that readers then see", async ({
  page,
}) => {
  const title = `Images smoke ${Date.now()}`;
  const main = page.getByRole("main");
  const file = page.getByLabel("Image file");
  const body = page.getByLabel("Body (Markdown)");
  await signIn(page);

  await page.goto("/admin/posts/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();

  await file.setInputFiles({
    name: "notes.txt",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(main.getByRole("alert")).toHaveText(
    "This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
  );
  await file.setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });
  await expect(main.getByRole("alert")).toHaveText(
    "This image is larger than the limit of 5 MB.",
  );

  // Holds the upload so the journey can try to save while it runs.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/admin/posts/**", async (route) => {
    if (route.request().postDataBuffer()?.includes('filename="Figure 1.png"')) {
      await held;
    }
    await route.continue();
  });
  await body.fill("Before the figure.");
  await file.setInputFiles({
    name: "Figure 1.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(main.getByText("Uploading…")).toBeVisible();
  for (const name of ["Save draft", "Publish", "Preview", "Move to trash"]) {
    await expect(page.getByRole("button", { name })).toBeDisabled();
  }
  release();
  await expect(body).toHaveValue(
    /^Before the figure\.\n\n!\[Figure 1\]\(\/media\/[0-9a-f-]{36}\.png\)\n$/,
  );
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("img", { name: "Figure 1" })).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(main.getByRole("status")).toHaveText("Published.");
  await page.getByRole("link", { name: "View post" }).click();
  const image = page.getByRole("article").getByRole("img", {
    name: "Figure 1",
  });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
  const response = await page.request.get(
    (await image.getAttribute("src")) ?? "",
  );
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(Buffer.from(await response.body())).toEqual(png);
});
