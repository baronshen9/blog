import type { ImageLimitsResponse } from "@/contract";
import { maxImageBytes } from "@/server/media";
import { handleApiRequest } from "@/app/api/v1/api";

export async function GET(request: Request): Promise<Response> {
  return handleApiRequest(request, async () => {
    const body: ImageLimitsResponse = { maxBytes: maxImageBytes };
    return Response.json(body);
  });
}
