import Link from "next/link";
import { listPosts } from "@/server/posts";
import { signOutAction } from "./actions";
import { requireOwner } from "./session";

export default async function AdminPage() {
  const owner = await requireOwner();
  const posts = await listPosts();
  return (
    <main>
      <h1>Posts</h1>
      <p>Signed in as {owner.username}.</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
      <p>
        <Link href="/admin/posts/new">New post</Link>
      </p>
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
                <td>{post.language}</td>
                <td>{post.status === "draft" ? "Draft" : "Published"}</td>
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
