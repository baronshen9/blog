import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { getPost } from "@/server/posts";
import { acceptedImageTypes, maxImageBytes } from "@/server/media";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/(owner)/posts/post-editor";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const post = await getPost(id.data).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <main>
      <PostEditor
        images={{ accept: acceptedImageTypes, maxBytes: maxImageBytes }}
        key={post.id}
        post={{
          status: post.status,
          path: `/${post.language}/posts/${post.slug}`,
          slugFixed: post.publishedAt !== null,
          savedAt: post.updatedAt.toISOString(),
        }}
        initial={{
          id: post.id,
          language: post.language,
          title: post.title,
          slug: post.slug,
          bodyMarkdown: post.bodyMarkdown,
          tags: post.tags,
        }}
      />
    </main>
  );
}
