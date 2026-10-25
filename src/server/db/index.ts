import { PrismaPg } from "@prisma/adapter-pg";
import { getConfig } from "@/server/config";
import { PrismaClient } from "./generated/client";

// One client per process; kept on globalThis so development reloads reuse it.
const globalForDb = globalThis as { blogDb?: PrismaClient };

export function getDb(): PrismaClient {
  globalForDb.blogDb ??= new PrismaClient({
    // A bounded wait for a pooled connection, so requests fail instead of
    // queuing forever behind a stalled database.
    adapter: new PrismaPg({
      connectionString: getConfig().DATABASE_URL,
      connectionTimeoutMillis: 5_000,
    }),
  });
  return globalForDb.blogDb;
}
