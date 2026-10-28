import { createTranslationRequest } from "@/contract";
import { createTranslation } from "@/server/posts";
import {
  handleApiRequest,
  readBody,
  readPostId,
  toPostResponse,
} from "@/app/api/v1/api";

type Context = { params: Promise<{ id: string }> };

// Creates the post's translation as a draft in its other language.
export async function POST(request: Request, { params }: Context) {
  return handleApiRequest(request, async () => {
    const id = await readPostId(params);
    const post = await createTranslation(
      id,
      await readBody(request, createTranslationRequest),
    );
    return Response.json(toPostResponse(post), { status: 201 });
  });
}
