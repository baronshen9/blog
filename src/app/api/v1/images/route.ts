import { type ImageResponse, uploadImageRequest } from "@/contract";
import { imageMarkdown } from "@/lib";
import { uploadImage } from "@/server/media";
import { handleApiRequest, readBody } from "@/app/api/v1/api";

export async function POST(request: Request): Promise<Response> {
  return handleApiRequest(request, async () => {
    const { alt, data } = await readBody(request, uploadImageRequest);
    const { path } = await uploadImage(Buffer.from(data, "base64"));
    const body: ImageResponse = { path, markdown: imageMarkdown(alt, path) };
    return Response.json(body, { status: 201 });
  });
}
