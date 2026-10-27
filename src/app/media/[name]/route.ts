import { DomainError } from "@/server/errors";
import { readImage } from "@/server/media";

// Serves an uploaded image. Its file name contains a new id for every upload,
// so a response never changes and browsers may keep it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  try {
    const { contentType, bytes } = await readImage((await params).name);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
}
