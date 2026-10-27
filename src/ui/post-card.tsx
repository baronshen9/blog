import Link from "next/link";
import { PostMeta } from "./post-meta";
import { TagList } from "./tag-list";
import styles from "./post-card.module.css";

// A post in a list: date and language, the title linking to the post, the
// excerpt, and the tags linking to their pages. The whole card is the title
// link's click target, except for the tag links.
export function PostCard({
  href,
  title,
  excerpt,
  tags,
  tagHref,
  ...meta
}: {
  href: string;
  title: string;
  excerpt: string;
  tags: string[];
  tagHref: (tag: string) => string;
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
      <TagList tags={tags} hrefFor={tagHref} />
    </article>
  );
}
