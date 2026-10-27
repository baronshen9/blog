import type { Metadata } from "next";
import { getConfig } from "@/server/config";
import { acceptedImageTypes, maxImageBytes } from "@/server/media";
import { requireOwner } from "@/app/admin/session";
import { PostEditor } from "@/app/admin/(owner)/posts/post-editor";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireOwner();
  return (
    <main>
      <PostEditor
        images={{ accept: acceptedImageTypes, maxBytes: maxImageBytes }}
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
