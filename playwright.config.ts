import { defineConfig } from "@playwright/test";

// Journeys run against the stack that scripts/smoke.sh starts.
export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  reporter: "list",
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000" },
});
