import {
  createPostRequest,
  listPostsQuery,
  type PostListResponse,
} from "@/contract";
import { createDraft, listPosts } from "@/server/posts";
import { handleApiRequest, readBody, toPostResponse } from "@/app/api/v1/api";

export async function GET(request: Request): Promise<Response> {
  return handleApiRequest(request, async () => {
    const { searchParams } = new URL(request.url);
    const { status } = listPostsQuery.parse(Object.fromEntries(searchParams));
    const posts = await listPosts(status);
    const body: PostListResponse = {
      posts: posts.map((post) => ({
        ...post,
        updatedAt: post.updatedAt.toISOString(),
      })),
    };
    return Response.json(body);
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleApiRequest(request, async () => {
    const post = await createDraft(await readBody(request, createPostRequest));
    return Response.json(toPostResponse(post), { status: 201 });
  });
}
