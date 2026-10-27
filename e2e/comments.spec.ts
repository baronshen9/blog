import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createToken, signIn } from "./owner";

test("a reader comments on a published post and it awaits moderation", async ({
  page,
  request,
}) => {
  const marker = randomUUID().slice(0, 8);
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Comments smoke ${marker}`)}`,
  };
  const created = await request.post("/api/v1/posts", {
    headers,
    data: { language: "en", title: `Comments ${marker}`, bodyMarkdown: "Hi" },
  });
  const { id, slug } = await created.json();
  await request.patch(`/api/v1/posts/${id}`, {
    headers,
    data: { status: "published" },
  });

  const form = page.getByRole("region", { name: "Leave a comment" });
  const nickname = form.getByLabel("Nickname");
  const message = form.getByLabel("Message");
  const send = form.getByRole("button", { name: "Send comment" });
  await page.goto(`/en/posts/${slug}`);

  await nickname.fill(`Reader ${marker}`);
  await message.fill("   ");
  await send.click();
  await expect(form.getByRole("alert")).toHaveText("Enter a message.");
  await expect(nickname).toHaveValue(`Reader ${marker}`);

  await message.fill(`Comment ${marker}`);
  await form.locator('input[name="website"]').fill("x", { force: true });
  await send.click();
  await expect(form.getByRole("alert")).toHaveText(
    "This comment looks automated and was not sent.",
  );
  await expect(message).toHaveValue(`Comment ${marker}`);

  await page.reload();
  await nickname.fill(`Reader ${marker}`);
  await message.fill(`Comment ${marker}`);
  await send.click();
  await expect(form.getByRole("status")).toHaveText(
    /Your comment awaits moderation/,
  );
  await expect(message).toHaveValue("");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: `Comments ${marker}` }),
  ).toBeVisible();
  await expect(page.getByText(`Comment ${marker}`)).toHaveCount(0);
});
