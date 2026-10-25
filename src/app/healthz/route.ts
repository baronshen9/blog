import { isDatabaseReachable } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const reachable = await isDatabaseReachable();
  return Response.json(
    { status: reachable ? "ok" : "unavailable" },
    { status: reachable ? 200 : 503 },
  );
}
