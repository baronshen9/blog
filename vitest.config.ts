import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Test files share one database; see src/server/db/testing/setup.ts.
    fileParallelism: false,
    globalSetup: ["src/server/db/testing/global-setup.ts"],
    setupFiles: ["src/server/db/testing/setup.ts"],
    hookTimeout: 120_000,
    env: {
      OWNER_USERNAME: "owner",
      OWNER_PASSWORD: "test-owner-password",
      SITE_DEFAULT_LANGUAGE: "en",
    },
  },
});
