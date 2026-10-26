import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { getPost } from "@/server/posts";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/posts/post-editor";

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
      <p>
        <Link href="/admin">All posts</Link>
      </p>
      <h1>Edit post</h1>
      {post.status === "draft" ? (
        <p>Status: Draft</p>
      ) : (
        <p>
          Status: Published —{" "}
          <Link href={`/${post.language}/posts/${post.slug}`}>View post</Link>
        </p>
      )}
      <PostEditor
        key={post.id}
        status={post.status}
        initial={{
          id: post.id,
          language: post.language,
          title: post.title,
          bodyMarkdown: post.bodyMarkdown,
        }}
      />
    </main>
  );
}
