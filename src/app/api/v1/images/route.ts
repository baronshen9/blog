import { type ImageResponse, uploadImageRequest } from "@/contract";
import { imageMarkdown } from "@/lib";
import { imageTooLarge, maxImageBytes, uploadImage } from "@/server/media";
import { type BodyLimit, handleApiRequest, readBody } from "@/app/api/v1/api";

// The body carries the image in Base64, 4 characters for every 3 bytes, with
// room for its description and the JSON around them. A larger body is refused
// with the image's size estimated from the body's.
const bodyLimit: BodyLimit = {
  bytes: Math.ceil(maxImageBytes / 3) * 4 + 64 * 1024,
  refuse: (bodyBytes) => imageTooLarge(Math.floor((bodyBytes * 3) / 4)),
};

export async function POST(request: Request): Promise<Response> {
  return handleApiRequest(request, async () => {
    const { alt, data } = await readBody(
      request,
      uploadImageRequest,
      bodyLimit,
    );
    const { path } = await uploadImage(Buffer.from(data, "base64"));
    const body: ImageResponse = { path, markdown: imageMarkdown(alt, path) };
    return Response.json(body, { status: 201 });
  });
}
