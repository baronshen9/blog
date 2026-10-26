import Link from "next/link";
import { LanguageLabel } from "./language-label";
import { StatusBadge } from "./status-badge";
import styles from "./post-table.module.css";

type PostRow = {
  id: string;
  href: string;
  title: string;
  language: React.ComponentProps<typeof LanguageLabel>["language"];
  status: React.ComponentProps<typeof StatusBadge>["status"];
  updatedAt: Date;
};

// The owner's posts with their language, status, and last change, each title
// opening the post's editor.
export function PostTable({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return <p className={styles.empty}>No posts yet.</p>;
  }
  return (
    <div className={styles.box}>
      <table className={styles.table}>
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
                <Link href={post.href} className={styles.title}>
                  {post.title}
                </Link>
              </td>
              <td>
                <LanguageLabel language={post.language} />
              </td>
              <td>
                <StatusBadge status={post.status} />
              </td>
              <td className={styles.date}>
                <time dateTime={post.updatedAt.toISOString()}>
                  {post.updatedAt.toISOString().slice(0, 10)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
