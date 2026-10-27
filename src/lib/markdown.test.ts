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
