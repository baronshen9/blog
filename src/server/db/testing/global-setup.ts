import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    mediaDir: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;
let mediaDir: string | undefined;

// Starts one Postgres for the whole run, applies the committed migrations, and
// fails when they do not produce the schema in prisma/schema.prisma. Uploaded
// images go to a directory of the run's own.
export async function setup(project: TestProject): Promise<void> {
  mediaDir = mkdtempSync(join(tmpdir(), "blog-media-"));
  project.provide("mediaDir", mediaDir);

  container = await new PostgreSqlContainer("postgres:18").start();
  const databaseUrl = container.getConnectionUri();

  prisma(["migrate", "deploy"], databaseUrl);
  prisma(
    [
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    databaseUrl,
  );

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown(): Promise<void> {
  await container?.stop();
  if (mediaDir) rmSync(mediaDir, { recursive: true, force: true });
}

function prisma(args: string[], databaseUrl: string): void {
  const result = spawnSync("npx", ["--no-install", "prisma", ...args], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    const hint =
      args[1] === "diff" ? " (schema changes without a migration)" : "";
    const message = `prisma ${args.slice(0, 2).join(" ")} failed${hint}`;
    // Printed as well as thrown: Vitest cannot format errors from global setup.
    console.error(message);
    throw new Error(message);
  }
}
