import { listPosts } from "@/server/posts";
import { ButtonLink, PageTitle, PostTable } from "@/ui";
import { requireOwner } from "@/app/admin/session";

export default async function AdminPage() {
  const owner = await requireOwner();
  const posts = await listPosts();
  return (
    <main>
      <PageTitle
        description={`Signed in as ${owner.username}.`}
        actions={
          <ButtonLink href="/admin/posts/new" variant="primary">
            New post
          </ButtonLink>
        }
      >
        Posts
      </PageTitle>
      <PostTable
        posts={posts.map((post) => ({
          ...post,
          href: `/admin/posts/${post.id}`,
        }))}
      />
    </main>
  );
}
