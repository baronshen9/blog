import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/server/config";
import { DomainError } from "@/server/errors";
import { acceptedImageTypes, maxImageBytes } from "@/server/media";
import { getPost, otherLanguage } from "@/server/posts";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/(owner)/posts/post-editor";

export const metadata: Metadata = { title: "New post" };

// A new post, or with `?translationOf=<id>` the translation of that post,
// which starts from its content in the other language. A post that already
// has its other version opens instead, since it gets no new translation.
export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ translationOf?: string | string[] }>;
}) {
  await requireOwner();
  const images = { accept: acceptedImageTypes, maxBytes: maxImageBytes };
  const { translationOf } = await searchParams;
  if (translationOf === undefined) {
    return (
      <main>
        <PostEditor
          images={images}
          initial={{
            title: "",
            bodyMarkdown: "",
            tags: [],
            language: getConfig().SITE_DEFAULT_LANGUAGE,
          }}
        />
      </main>
    );
  }

  const id = z.uuid().safeParse(translationOf);
  if (!id.success) notFound();
  const source = await getPost(id.data).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  if (source.translation) redirect(`/admin/posts/${source.id}`);
  return (
    <main>
      <PostEditor
        images={images}
        translation={{
          id: source.id,
          language: source.language,
          title: source.title,
          status: source.status,
          trashed: false,
        }}
        initial={{
          translationOf: source.id,
          title: source.title,
          bodyMarkdown: source.bodyMarkdown,
          tags: source.tags,
          language: otherLanguage(source.language),
        }}
      />
    </main>
  );
}
