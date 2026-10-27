import { expect, test } from "@playwright/test";
import { createToken, marker, signIn } from "./owner";

test("the owner approves, rejects, and removes reader comments", async ({
  page,
  request,
}) => {
  const mark = marker();
  const approved = `Approved ${mark}`;
  const rejected = `Rejected ${mark}`;
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Moderation smoke ${mark}`)}`,
  };
  const created = await request.post("/api/v1/posts", {
    headers,
    data: { language: "en", title: `Moderated ${mark}`, bodyMarkdown: "Hi" },
  });
  const { id, slug } = await created.json();
  const setStatus = (status: string) =>
    request.patch(`/api/v1/posts/${id}`, { headers, data: { status } });
  await setStatus("published");

  const postUrl = `/en/posts/${slug}`;
  const form = page.getByRole("region", { name: "Leave a comment" });
  await page.goto(postUrl);
  for (const message of [approved, rejected]) {
    await form.getByLabel("Nickname").fill(`Reader ${mark}`);
    await form.getByLabel("Message").fill(message);
    await form.getByRole("button", { name: "Send comment" }).click();
    await expect(form.getByRole("status")).toBeVisible();
    await page.reload();
  }
  const list = page.getByRole("region", { name: /^Comments/ });
  await expect(list).toHaveCount(0);

  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await nav.getByRole("link", { name: /^Comments \d+ pending$/ }).click();
  const pending = page.getByRole("region", { name: /^Pending/ });
  const approvedRow = pending.getByRole("row").filter({ hasText: approved });
  await expect(approvedRow).toContainText(`Moderated ${mark}`);
  await expect(approvedRow).toContainText(`Reader ${mark}`);
  await approvedRow.getByRole("button", { name: "Approve" }).click();
  await expect(approvedRow).toHaveCount(0);
  const rejectedRow = pending.getByRole("row").filter({ hasText: rejected });
  await rejectedRow.getByRole("button", { name: "Reject" }).click();
  await expect(rejectedRow).toHaveCount(0);
  const removable = page
    .getByRole("region", { name: /^Approved/ })
    .getByRole("row")
    .filter({ hasText: approved });
  await expect(removable).toBeVisible();

  await page.goto(postUrl);
  await expect(list).toContainText(`Reader ${mark}`);
  await expect(list).toContainText(approved);
  await expect(page.getByText(rejected)).toHaveCount(0);

  await setStatus("draft");
  expect((await page.goto(postUrl))?.status()).toBe(404);
  await setStatus("published");
  await page.goto(postUrl);
  await expect(list).toContainText(approved);

  await page.goto("/admin/comments");
  page.once("dialog", (dialog) => dialog.accept());
  await removable.getByRole("button", { name: "Remove" }).click();
  await expect(removable).toHaveCount(0);
  await page.goto(postUrl);
  await expect(page.getByText(approved)).toHaveCount(0);
});
