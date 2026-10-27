import { beforeEach, inject } from "vitest";
import { getDb } from "@/server/db";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.MEDIA_DIR = inject("mediaDir");

// Every test starts with every application table empty. Test files run one at
// a time (`fileParallelism: false` in vitest.config.ts), so no other test can
// change the database while one runs.
beforeEach(async () => {
  await getDb().$executeRaw`
    DO $$ BEGIN
      EXECUTE (
        SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' CASCADE'
        FROM pg_tables
        WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
      );
    END $$`;
});
