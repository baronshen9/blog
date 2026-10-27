import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, test } from "@playwright/test";
import { postResponse } from "../src/contract/index.ts";
import { createToken, signIn } from "./owner";

test("an assistant publishes a draft through the MCP server with the owner's token", async ({
  page,
  baseURL,
}) => {
  const title = `MCP smoke ${Date.now()}`;
  await signIn(page);
  const secret = await createToken(page, title);

  // Started the way Claude Code and Codex start it; see the README.
  const client = new Client({ name: "smoke", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["src/mcp/server.ts"],
      env: { BLOG_URL: baseURL ?? "", BLOG_API_TOKEN: secret },
      stderr: "inherit",
    }),
  );
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;
    const [content] = result.content;
    expect(result.isError ?? false).toBe(false);
    return content?.type === "text" ? content.text : "";
  };

  try {
    const draft = postResponse.parse(
      JSON.parse(
        await call("create_draft", {
          language: "en",
          title,
          bodyMarkdown: "Written *through MCP*.",
        }),
      ),
    );
    expect((await page.goto(`/en/posts/${draft.slug}`))?.status()).toBe(404);
    await page.goto(`/admin/posts/${draft.id}`);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
    await expect(
      page.getByRole("main").getByText("Status: Draft"),
    ).toBeVisible();

    const published = postResponse.parse(
      JSON.parse(await call("publish_post", { id: draft.id })),
    );
    expect(published.status).toBe("published");
    await page.goto(`/en/posts/${draft.slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("em", { hasText: "through MCP" })).toBeVisible();

    await call("delete_post", { id: draft.id });
    expect((await page.goto(`/en/posts/${draft.slug}`))?.status()).toBe(404);
  } finally {
    await client.close();
  }
});
