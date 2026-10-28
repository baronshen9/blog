import { expect, test } from "vitest";
import { imageMarkdown, renderMarkdown } from ".";

test("renders headings, lists, links, and highlighted code", async () => {
  const html = await renderMarkdown(`# Title

- one
- [a link](https://example.com)

\`\`\`ts
const answer = 42;
\`\`\`
`);

  expect(html).toContain("<h1>Title</h1>");
  expect(html).toContain("<li>one</li>");
  expect(html).toContain('<a href="https://example.com">a link</a>');
  expect(html).toMatch(/<pre class="shiki[^"]*"[^>]*><code>/);
  expect(html).toContain(
    '<span style="color:var(--color-code-token-keyword)">const</span>',
  );
});

test("renders code in an unknown language as plain text", async () => {
  const html = await renderMarkdown("```nolang\n<b>x</b>\n```");

  expect(html).toContain('<pre class="shiki');
  expect(html).toContain("&#x3C;b>x&#x3C;/b>");
});

test("does not render raw HTML or script URLs", async () => {
  const html = await renderMarkdown(
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1))',
  );

  expect(html).not.toMatch(/<script|<img|onerror|javascript:/);
});

test("inserts an uploaded image that renders with its description", async () => {
  const markdown = imageMarkdown("Plot [v2]", "/media/a.png");

  expect(markdown).toBe("![Plot \\[v2\\]](/media/a.png)");
  expect(await renderMarkdown(markdown)).toBe(
    '<p><img src="/media/a.png" alt="Plot [v2]"></p>',
  );
});

test("keeps a multi-line image description on one line", async () => {
  const markdown = imageMarkdown("first\n\nsecond\r\nthird", "/media/a.png");

  expect(markdown).toBe("![first second third](/media/a.png)");
  expect(await renderMarkdown(markdown)).toBe(
    '<p><img src="/media/a.png" alt="first second third"></p>',
  );
});

test("keeps the image when the description has code or tag characters", async () => {
  const markdown = imageMarkdown("a ` b <i> c", "/media/a.png");

  expect(await renderMarkdown(`${markdown} Use \`code\` here.`)).toBe(
    '<p><img src="/media/a.png" alt="a &#x60; b <i> c"> Use <code>code</code> here.</p>',
  );
});

test("links footnotes and their references to each other", async () => {
  const html = await renderMarkdown(
    "One[^a], again[^a], and two[^注].\n\n[^a]: First.\n[^注]: Second.",
  );
  const values = (pattern: RegExp) =>
    Array.from(html.matchAll(pattern), ([, value]) => String(value));
  const targets = values(/href="#([^"]+)"/g);
  const ids = values(/ id="([^"]+)"/g);
  const linked = (id: string) => /fn(ref)?-/.test(id);

  // Three references and three links back, each to an element on the page.
  expect(targets).toHaveLength(6);
  expect(ids).toEqual(expect.arrayContaining(targets));
  expect(ids.filter(linked).sort()).toEqual([...new Set(targets)].sort());
});

test("gives every footnote and reference its own ID, whatever the names", async () => {
  const html = await renderMarkdown(
    "First[^a], repeat[^a], other[^a-2].\n\n[^a]: First note.\n[^a-2]: Other note.",
  );
  const ids = Array.from(html.matchAll(/ id="([^"]+)"/g), ([, id]) => id);
  expect(new Set(ids).size).toBe(ids.length);

  // Each reference links to its footnote, which links back to that reference.
  const references = Array.from(
    html.matchAll(/<a href="#([^"]+)" id="([^"]+)" data-footnote-ref/g),
    ([, footnote, reference]) => ({ footnote, reference }),
  );
  expect(references).toHaveLength(3);
  for (const { footnote, reference } of references) {
    const item = new RegExp(`<li id="${footnote}">[\\s\\S]*?</li>`).exec(html);
    expect(item?.[0]).toContain(`href="#${reference}"`);
  }
  expect(html).toContain("First note.");
  expect(html).toContain("Other note.");
});

test("labels footnotes in the language of the page", async () => {
  const markdown = "正文[^1]，再引[^1]。\n\n[^1]: 注释";

  const chinese = await renderMarkdown(markdown, {
    heading: "脚注",
    backToReference: (reference) => `返回引用 ${reference}`,
  });
  expect(chinese).toContain(">脚注</h2>");
  expect(chinese).toContain('aria-label="返回引用 1"');
  expect(chinese).toContain('aria-label="返回引用 1-2"');

  const english = await renderMarkdown(markdown);
  expect(english).toContain(">Footnotes</h2>");
  expect(english).toContain('aria-label="Back to reference 1"');
  expect(english).toContain('aria-label="Back to reference 1-2"');
});
