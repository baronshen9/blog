import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// remark-rehype drops raw HTML, and the sanitizer removes unsafe URLs and
// attributes before Shiki adds its own highlighting markup. Languages load on
// first use; unknown ones render as plain text. Code uses one dark theme in
// both color schemes.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeShiki, {
    theme: "github-dark-default",
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
