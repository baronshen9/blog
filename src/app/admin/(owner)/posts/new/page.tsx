import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/server/config";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/(owner)/posts/post-editor";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireOwner();
  return (
    <main>
      <p>
        <Link href="/admin">All posts</Link>
      </p>
      <h1>New post</h1>
      <PostEditor
        initial={{
          title: "",
          bodyMarkdown: "",
          language: getConfig().SITE_DEFAULT_LANGUAGE,
        }}
      />
    </main>
  );
}
