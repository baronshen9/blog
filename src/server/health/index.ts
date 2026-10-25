import { getDb } from "@/server/db";

// Below the 5 s timeout of the Compose health check, so a stalled database
// yields an answer instead of a hung request.
const timeoutMs = 3_000;

export async function isDatabaseReachable(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  try {
    await Promise.race([getDb().$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch (error) {
    console.error(
      "health: database unreachable:",
      error instanceof Error ? error.message : error,
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
