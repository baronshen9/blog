import { expect, test } from "@playwright/test";
import { createToken, marker, signIn } from "./owner";

test("readers follow footnotes both ways, labelled in the page's language", async ({
  page,
  request,
}) => {
  const mark = marker();
  await signIn(page);
  const headers = {
    authorization: `Bearer ${await createToken(page, `Footnote smoke ${mark}`)}`,
  };
  const publish = async (language: string, bodyMarkdown: string) => {
    const created = await request.post("/api/v1/posts", {
      headers,
      data: { language, title: `Footnotes ${language} ${mark}`, bodyMarkdown },
    });
    const { id, slug } = await created.json();
    await request.patch(`/api/v1/posts/${id}`, {
      headers,
      data: { status: "published" },
    });
    return `/${language}/posts/${slug}`;
  };
  const chinese = await publish("zh", `正文[^1]\n\n[^1]: 注释 ${mark}`);
  const english = await publish("en", `Body[^1]\n\n[^1]: Note ${mark}`);

  const main = page.getByRole("main");
  for (const [path, heading, back] of [
    [chinese, "脚注", "返回引用 1"],
    [english, "Footnotes", "Back to reference 1"],
  ] as const) {
    await page.goto(path);
    await expect(
      main.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const reference = main.getByRole("link", { name: "1", exact: true });
    const target = page.locator(":target");

    // Each link's fragment names an element on the page: the browser targets it.
    await reference.click();
    await expect(page).toHaveURL(/#user-content-fn-1$/);
    await expect(target).toHaveRole("listitem");
    await expect(target).toContainText(mark);

    await main.getByRole("link", { name: back, exact: true }).click();
    await expect(page).toHaveURL(/#user-content-fnref-1$/);
    await expect(target).toHaveText("1");
  }
});
