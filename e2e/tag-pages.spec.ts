import { expect, test } from "@playwright/test";
import { createToken, homeCard, marker, signIn } from "./owner";

test("readers browse published posts by their Chinese and English tags", async ({
  page,
  request,
}) => {
  const stamp = marker();
  const english = `smoke-${stamp}`;
  const chinese = `标签${stamp}`;
  const hidden = `hidden-${stamp}`;
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Tag pages smoke ${stamp}`)}`,
  };
  const create = async (
    title: string,
    tags: string[],
    status = "published",
  ) => {
    const created = await request.post("/api/v1/posts", {
      headers,
      data: { language: "en", title, bodyMarkdown: "Body", tags },
    });
    const { id } = await created.json();
    await request.patch(`/api/v1/posts/${id}`, { headers, data: { status } });
  };
  await create(`Tagged older ${stamp}`, [english, chinese]);
  await create(`Tagged newer ${stamp}`, [english]);
  await create(`Draft ${stamp}`, [english, hidden], "draft");

  const main = page.getByRole("main");
  const titles = main.getByRole("article").getByRole("heading");
  const card = main
    .getByRole("article")
    .filter({ hasText: `Tagged older ${stamp}` });

  // A card's tag opens the tag page, not the post the card links to.
  await homeCard(page, `Tagged older ${stamp}`);
  await expect(
    card.getByRole("list", { name: "Tags" }).getByRole("listitem"),
  ).toHaveText([`#${english}`, `#${chinese}`]);
  await card.getByRole("link", { name: english }).click();
  await expect(page).toHaveURL(`/en/tags/${english}`);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    `#${english}`,
  );
  await expect(titles).toHaveText([
    `Tagged newer ${stamp}`,
    `Tagged older ${stamp}`,
  ]);

  // The post page links its tags too, Chinese names included.
  await titles.getByRole("link", { name: `Tagged older ${stamp}` }).click();
  await main.getByRole("link", { name: chinese }).click();
  await expect(page).toHaveURL(`/en/tags/${encodeURIComponent(chinese)}`);
  await expect(titles).toHaveText([`Tagged older ${stamp}`]);

  // Search results show tags; a tag only drafts carry is nowhere public.
  await page.goto(`/en/search?q=${stamp}`);
  await expect(main.getByRole("link", { name: english })).toHaveCount(2);
  await expect(main.getByRole("link", { name: hidden })).toHaveCount(0);
  const response = await page.goto(`/en/tags/${hidden}`);
  expect(response?.status()).toBe(404);

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/zh/tags/${encodeURIComponent(chinese)}`);
  await expect(titles).toHaveText([`Tagged older ${stamp}`]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
