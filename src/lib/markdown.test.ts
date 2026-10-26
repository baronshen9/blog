import { expect, test } from "vitest";
import { renderMarkdown } from ".";

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
  expect(html).toMatch(/<span style="color:#[0-9A-F]{6}">const<\/span>/i);
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
