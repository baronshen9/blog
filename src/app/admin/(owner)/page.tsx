import { listPosts } from "@/server/posts";
import { ButtonLink, PageHeader, PostTable } from "@/ui";
import { requireOwner } from "@/app/admin/session";

export default async function AdminPage() {
  const owner = await requireOwner();
  const posts = await listPosts();
  return (
    <main>
      <PageHeader
        title="Posts"
        description={`Signed in as ${owner.username}.`}
        actions={
          <ButtonLink href="/admin/posts/new" variant="primary">
            New post
          </ButtonLink>
        }
      />
      <PostTable
        posts={posts.map((post) => ({
          ...post,
          href: `/admin/posts/${post.id}`,
        }))}
      />
    </main>
  );
}
