import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env; values already in the environment win.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
