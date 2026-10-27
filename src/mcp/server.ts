// The blog's MCP server over stdio. Claude Code or Codex starts it on the
// owner's machine with `node src/mcp/server.ts` and sets BLOG_URL and
// BLOG_API_TOKEN in its MCP configuration; see the README.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBlogServer } from "./blog.ts";

await createBlogServer({
  url: process.env.BLOG_URL,
  token: process.env.BLOG_API_TOKEN,
  fetch,
}).connect(new StdioServerTransport());
