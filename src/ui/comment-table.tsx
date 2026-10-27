import Link from "next/link";
import styles from "./post-table.module.css";

type CommentRow = {
  id: string;
  nickname: string;
  message: string;
  createdAt: Date;
  post: { title: string; href: string };
  actions: React.ReactNode;
};

// Reader comments for the owner to moderate: the post each belongs to (its
// title opening the post's editor), the nickname, the message as written, the
// time it arrived (UTC), and the actions on each. It shares the post list's
// look; `empty` is shown when there are no comments.
export function CommentTable({
  comments,
  empty,
}: {
  comments: CommentRow[];
  empty: string;
}) {
  if (comments.length === 0) {
    return <p className={styles.empty}>{empty}</p>;
  }
  return (
    <div className={styles.box}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Post</th>
            <th>Nickname</th>
            <th>Message</th>
            <th>Received</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {comments.map((comment) => (
            <tr key={comment.id} className={styles.top}>
              <td>
                <Link href={comment.post.href} className={styles.title}>
                  {comment.post.title}
                </Link>
              </td>
              <td className={styles.wrap}>{comment.nickname}</td>
              <td className={styles.message}>{comment.message}</td>
              <td className={styles.date}>
                <time dateTime={comment.createdAt.toISOString()}>
                  {comment.createdAt
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  UTC
                </time>
              </td>
              <td>
                <div className={styles.actions}>{comment.actions}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
