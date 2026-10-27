import { expect, test } from "@playwright/test";
import { postResponse } from "../src/contract/index.ts";
import { connectMcp, createToken, marker, signIn } from "./owner";

test("the owner tags a post in the admin and through MCP alike", async ({
  page,
  baseURL,
}) => {
  const title = `Tags smoke ${marker()}`;
  const main = page.getByRole("main");
  const field = page.getByRole("textbox", { name: "Tags" });
  const tags = main.getByRole("list", { name: "Tags" }).getByRole("listitem");
  await signIn(page);
  const secret = await createToken(page, title);

  await page.goto("/admin/posts/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await field.fill("TypeScript");
  await field.press("Enter");
  await field.fill("Next JS, next_js");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByText("Status: Draft")).toBeVisible();
  await expect(tags).toHaveText(["typescript×", "next-js×"]);

  await page.getByRole("button", { name: "Remove typescript" }).click();
  await field.fill("数据库");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(main.getByRole("status")).toHaveText("Draft saved.");
  await page.reload();
  await expect(tags).toHaveText(["next-js×", "数据库×"]);
  const id = page.url().split("/").pop() ?? "";

  const { call, close } = await connectMcp(baseURL, secret);
  try {
    const read = postResponse.parse(JSON.parse(await call("get_post", { id })));
    expect(read.tags).toEqual(["next-js", "数据库"]);
    const edited = postResponse.parse(
      JSON.parse(await call("update_post", { id, tags: ["Next  JS", "Rust"] })),
    );
    expect(edited.tags).toEqual(["next-js", "rust"]);
  } finally {
    await close();
  }
  await page.reload();
  await expect(tags).toHaveText(["next-js×", "rust×"]);
});
