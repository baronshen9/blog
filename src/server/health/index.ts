import { getDb } from "@/server/db";

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error(
      "health: database unreachable:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
