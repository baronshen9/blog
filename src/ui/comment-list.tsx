import { messages, type Locale } from "@/messages";
import styles from "./comment-list.module.css";

type CommentItem = {
  id: string;
  nickname: string;
  message: string;
  createdAt: Date;
};

// A post's approved comments, oldest first as given, each with its nickname,
// day (UTC, YYYY-MM-DD), and message as the reader wrote it. Nothing is shown
// while a post has no comments.
export function CommentList({
  comments,
  locale,
}: {
  comments: CommentItem[];
  locale: Locale;
}) {
  if (comments.length === 0) return null;
  return (
    <section className={styles.comments} aria-labelledby="comment-list-title">
      <h2 id="comment-list-title" className={styles.title}>
        {messages[locale].comments.list(comments.length)}
      </h2>
      <ol className={styles.list}>
        {comments.map((comment) => (
          <li key={comment.id} className={styles.comment}>
            <p className={styles.meta}>
              <span className={styles.nickname}>{comment.nickname}</span>
              <time dateTime={comment.createdAt.toISOString()}>
                {comment.createdAt.toISOString().slice(0, 10)}
              </time>
            </p>
            <p className={styles.message}>{comment.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
