import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { createCssVariablesTheme } from "shiki";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// remark-rehype drops raw HTML, and the sanitizer removes unsafe URLs and
// attributes before Shiki adds its own highlighting markup. Languages load on
// first use; unknown ones render as plain text. Highlighting colors are the
// --color-code-* design tokens, one dark set for both color schemes.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeShiki, {
    theme: createCssVariablesTheme({ variablePrefix: "--color-code-" }),
    langs: [],
    lazy: true,
    defaultLanguage: "text",
    fallbackLanguage: "text",
  })
  .use(rehypeStringify);

// The one renderer for the admin preview and the public pages.
export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}

// Markdown that shows the image at `path`, with `alt` as its description.
// Line breaks become spaces, since a blank line would end the image, and the
// characters that could open a code span, a tag, or a link inside the
// description are escaped, so the image survives any text around it.
export function imageMarkdown(alt: string, path: string): string {
  const description = alt.replace(/\s*[\r\n]+\s*/g, " ");
  return `![${description.replace(/[\\[\]`<]/g, "\\$&")}](${path})`;
}
