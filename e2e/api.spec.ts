import { expect, test } from "@playwright/test";
import { signIn } from "./owner";

test("an assistant publishes a post through the API with the owner's token", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  await signIn(page);
  await page.goto("/admin/tokens");
  await page.getByLabel("Token name").fill(`API smoke ${stamp}`);
  await page.getByRole("button", { name: "Create token" }).click();
  const secret = await page.getByLabel("Secret").inputValue();
  const headers = { authorization: `Bearer ${secret}` };

  const refused = await request.get("/api/v1/posts");
  expect(refused.status()).toBe(401);
  expect((await refused.json()).error.code).toBe("UNAUTHORIZED");

  const created = await request.post("/api/v1/posts", {
    headers,
    data: { language: "en", title: `API smoke ${stamp}`, bodyMarkdown: "Hi" },
  });
  expect(created.status()).toBe(201);
  const { id, slug } = await created.json();
  const published = await request.patch(`/api/v1/posts/${id}`, {
    headers,
    data: { status: "published" },
  });
  expect((await published.json()).status).toBe("published");

  await page.goto(`/en/posts/${slug}`);
  await expect(
    page.getByRole("heading", { name: `API smoke ${stamp}` }),
  ).toBeVisible();

  expect(
    (await request.delete(`/api/v1/posts/${id}`, { headers })).status(),
  ).toBe(204);
  expect((await page.goto(`/en/posts/${slug}`))?.status()).toBe(404);
});
