import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, type Page } from "@playwright/test";

// scripts/smoke.sh starts the stack with .env.example, so its owner is ours.
const env = parseEnv(readFileSync(".env.example", "utf8"));
export const username = env.OWNER_USERNAME ?? "";
export const password = env.OWNER_PASSWORD ?? "";

export async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Creates an API token in the admin and returns its secret.
export async function createToken(page: Page, name: string): Promise<string> {
  await page.goto("/admin/tokens");
  await page.getByLabel("Token name").fill(name);
  await page.getByRole("button", { name: "Create token" }).click();
  return page.getByLabel("Secret").inputValue();
}

// Starts the MCP server the way Claude Code and Codex start it (see the
// README) with the given token. `call` expects the tool to succeed and
// `refusal` expects it to fail; both return its text.
export async function connectMcp(baseURL: string | undefined, secret: string) {
  const client = new Client({ name: "smoke", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["src/mcp/server.ts"],
      env: { BLOG_URL: baseURL ?? "", BLOG_API_TOKEN: secret },
      stderr: "inherit",
    }),
  );
  const run = async (
    name: string,
    args: Record<string, unknown>,
    isError: boolean,
  ) => {
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;
    const [content] = result.content;
    expect(result.isError ?? false).toBe(isError);
    return content?.type === "text" ? content.text : "";
  };
  return {
    call: (name: string, args: Record<string, unknown>) =>
      run(name, args, false),
    refusal: (name: string, args: Record<string, unknown>) =>
      run(name, args, true),
    close: () => client.close(),
  };
}
