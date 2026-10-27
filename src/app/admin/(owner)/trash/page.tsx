import type { Metadata } from "next";
import { listTrashedPosts } from "@/server/posts";
import { Button, PageTitle, TrashTable } from "@/ui";
import { requireOwner } from "@/app/admin/session";
import { restorePostAction } from "./actions";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  await requireOwner();
  const posts = await listTrashedPosts();
  return (
    <main>
      <PageTitle description="Restoring a post brings it back as a draft.">
        Trash
      </PageTitle>
      <TrashTable
        posts={posts.map((post) => ({
          ...post,
          actions: (
            <>
              <form action={restorePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <Button type="submit">Restore</Button>
              </form>
              <DeleteForm id={post.id} title={post.title} />
            </>
          ),
        }))}
      />
    </main>
  );
}
