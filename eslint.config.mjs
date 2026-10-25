import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Module dependency direction from docs/design/architecture.md. Modules import
// each other through the `@/` alias, so every cross-module import is visible
// to these rules; parent-relative imports would bypass them.
const parentRelative = {
  group: ["../*"],
  message: "Import other modules through `@/`.",
};
const moduleInternals = {
  group: ["@/server/*/**", "@/contract/**", "@/lib/**", "@/ui/**"],
  message: "Use another module only through its index.ts.",
};
const nextRequestApis = {
  group: ["next/headers", "next/server", "next/navigation", "next/cache"],
  message: "Only src/app/ uses Next.js request APIs.",
};
const prisma = {
  group: ["@prisma/*", "**/generated/*"],
  message: "Only src/server/db/ uses Prisma.",
};
const forbid = (modules, message) => ({
  group: modules.map((module) => `@/${module}`),
  message,
});
const allowOnly = (modules, message) => ({
  regex: `^@/(?!(${modules.join("|")})$)`,
  message,
});

const restrict = (files, patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".worktrees/**",
    "src/server/db/generated/**",
    "next-env.d.ts",
  ]),
  restrict(
    ["src/app/**"],
    [
      parentRelative,
      moduleInternals,
      prisma,
      forbid(
        ["server/db", "mcp", "mcp/**"],
        "Routes call server services, never the database or the MCP server.",
      ),
    ],
  ),
  restrict(
    ["src/server/**"],
    [
      parentRelative,
      moduleInternals,
      prisma,
      nextRequestApis,
      forbid(
        ["app", "app/**", "ui", "ui/**", "mcp", "mcp/**"],
        "Server code depends only on server, contract, and lib.",
      ),
    ],
  ),
  restrict(
    ["src/server/db/**"],
    [
      parentRelative,
      moduleInternals,
      nextRequestApis,
      allowOnly(
        ["server/config"],
        "The Prisma client depends only on server/config.",
      ),
    ],
  ),
  restrict(
    ["src/ui/**"],
    [
      parentRelative,
      moduleInternals,
      prisma,
      nextRequestApis,
      allowOnly(["lib"], "UI components depend only on lib."),
    ],
  ),
  restrict(
    ["src/lib/**", "src/contract/**"],
    [
      parentRelative,
      prisma,
      nextRequestApis,
      allowOnly([], "Pure modules depend on nothing in src/."),
    ],
  ),
  restrict(
    ["src/mcp/**"],
    [
      prisma,
      nextRequestApis,
      {
        group: ["@/*", "../app/*", "../server/*", "../ui/*", "../lib/*"],
        message: "The MCP server imports only src/contract/, by relative path.",
      },
    ],
  ),
]);
