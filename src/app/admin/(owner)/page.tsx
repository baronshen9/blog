import Link from "next/link";
import { listPosts } from "@/server/posts";
import { LanguageLabel, StatusBadge } from "@/ui";
import { requireOwner } from "@/app/admin/session";

export default async function AdminPage() {
  const owner = await requireOwner();
  const posts = await listPosts();
  return (
    <main>
      <h1>Posts</h1>
      <p>Signed in as {owner.username}.</p>
      {posts.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Language</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link href={`/admin/posts/${post.id}`}>{post.title}</Link>
                </td>
                <td>
                  <LanguageLabel language={post.language} />
                </td>
                <td>
                  <StatusBadge status={post.status} />
                </td>
                <td>
                  <time dateTime={post.updatedAt.toISOString()}>
                    {post.updatedAt.toISOString().slice(0, 10)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
