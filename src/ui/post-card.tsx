import Link from "next/link";
import { PostMeta } from "./post-meta";
import styles from "./post-card.module.css";

// A post in a list: date and language, the title linking to the post, and the
// excerpt. The whole card is the link's click target.
export function PostCard({
  href,
  title,
  excerpt,
  ...meta
}: {
  href: string;
  title: string;
  excerpt: string;
} & React.ComponentProps<typeof PostMeta>) {
  return (
    <article className={styles.card}>
      <PostMeta {...meta} />
      <h2 className={styles.title}>
        <Link href={href} className={styles.link}>
          {title}
        </Link>
      </h2>
      {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
    </article>
  );
}
