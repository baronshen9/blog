import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { createCssVariablesTheme } from "shiki";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// The text a rendered body shows around its footnotes: the heading of the
// footnote list and the accessible label of a link back to a reference such
// as "1" or, for the second reference to the same footnote, "1-2".
export type FootnoteText = {
  heading: string;
  backToReference: (reference: string) => string;
};

const codeTheme = createCssVariablesTheme({ variablePrefix: "--color-code-" });

// remark-rehype drops raw HTML, and the sanitizer removes unsafe URLs and
// attributes before Shiki adds its own highlighting markup. Languages load on
// first use; unknown ones render as plain text. Highlighting colors are the
// --color-code-* design tokens, one dark set for both color schemes.
//
// remark-rehype already prefixes the footnote IDs with `user-content-` against
// DOM clobbering, in the IDs and the links to them alike; with raw HTML
// dropped, no other IDs or names reach the sanitizer, so it must not prefix
// the IDs a second time, which would break the links.
function processor(footnotes: FootnoteText | undefined) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      footnoteLabel: footnotes?.heading,
      footnoteBackLabel:
        footnotes &&
        ((referenceIndex, rereferenceIndex) =>
          footnotes.backToReference(
            `${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ""}`,
          )),
    })
    .use(rehypeSanitize, { ...defaultSchema, clobber: [] })
    .use(rehypeShiki, {
      theme: codeTheme,
      langs: [],
      lazy: true,
      defaultLanguage: "text",
      fallbackLanguage: "text",
    })
    .use(rehypeStringify);
}

// The one renderer for the admin preview and the public pages. Public pages
// pass the footnote text of their language; the English admin preview keeps
// the renderer's own English text.
export async function renderMarkdown(
  markdown: string,
  footnotes?: FootnoteText,
): Promise<string> {
  return String(await processor(footnotes).process(markdown));
}

// Markdown that shows the image at `path`, with `alt` as its description.
// Line breaks become spaces, since a blank line would end the image, and the
// characters that could open a code span, a tag, or a link inside the
// description are escaped, so the image survives any text around it.
export function imageMarkdown(alt: string, path: string): string {
  const description = alt.replace(/\s*[\r\n]+\s*/g, " ");
  return `![${description.replace(/[\\[\]`<]/g, "\\$&")}](${path})`;
}
