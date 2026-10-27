import { LanguageLabel } from "./language-label";
import styles from "./post-table.module.css";

type TrashRow = {
  id: string;
  title: string;
  language: React.ComponentProps<typeof LanguageLabel>["language"];
  trashedAt: Date;
  actions: React.ReactNode;
};

// The owner's trashed posts with their language, the day they were trashed,
// and the actions on each. It shares the post list's look.
export function TrashTable({ posts }: { posts: TrashRow[] }) {
  if (posts.length === 0) {
    return <p className={styles.empty}>The trash is empty.</p>;
  }
  return (
    <div className={styles.box}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Language</th>
            <th>Trashed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td className={styles.text}>{post.title}</td>
              <td>
                <LanguageLabel language={post.language} />
              </td>
              <td className={styles.date}>
                <time dateTime={post.trashedAt.toISOString()}>
                  {post.trashedAt.toISOString().slice(0, 10)}
                </time>
              </td>
              <td>
                <div className={styles.actions}>{post.actions}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
