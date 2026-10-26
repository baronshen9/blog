import type { Metadata } from "next";
import { getConfig } from "@/server/config";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/(owner)/posts/post-editor";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireOwner();
  return (
    <main>
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
