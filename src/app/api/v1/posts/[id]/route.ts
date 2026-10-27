import { updatePostRequest } from "@/contract";
import { getPost, trashPost, updatePost } from "@/server/posts";
import {
  handleApiRequest,
  readBody,
  readPostId,
  toPostResponse,
} from "@/app/api/v1/api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApiRequest(request, async () => {
    const post = await getPost(await readPostId(params));
    return Response.json(toPostResponse(post));
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return handleApiRequest(request, async () => {
    const id = await readPostId(params);
    const post = await updatePost(
      id,
      await readBody(request, updatePostRequest),
    );
    return Response.json(toPostResponse(post));
  });
}

// Moves the post to the trash; the API has no permanent deletion.
export async function DELETE(request: Request, { params }: Context) {
  return handleApiRequest(request, async () => {
    await trashPost(await readPostId(params));
    return new Response(null, { status: 204 });
  });
}
