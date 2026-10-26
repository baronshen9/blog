import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const parser = unified().use(remarkParse).use(remarkGfm);

// Blocks whose text is separated from the next block's by a space.
const blocks = new Set(["paragraph", "heading", "tableCell", "break"]);

// The plain text of a post's prose for lists, cut after maxLength characters
// with an ellipsis. Code blocks, raw HTML, and images are left out.
export function excerpt(markdown: string, maxLength = 200): string {
  const text = plainText(parser.parse(markdown)).replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= maxLength) return text;
  return `${characters.slice(0, maxLength).join("").trimEnd()}…`;
}

function plainText(node: Nodes): string {
  if (node.type === "code" || node.type === "html") return "";
  const text =
    "value" in node
      ? node.value
      : "children" in node
        ? node.children.map(plainText).join("")
        : "";
  return blocks.has(node.type) ? `${text} ` : text;
}
