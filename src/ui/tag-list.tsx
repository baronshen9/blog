import Link from "next/link";
import { messages, type Locale } from "@/messages";
import styles from "./tag-list.module.css";

// A published post's tags as links to their tag pages; nothing when the post
// has none. The links sit above a PostCard's stretched title link, so each
// opens its tag page rather than the post.
export function TagList({
  tags,
  hrefFor,
  locale,
}: {
  tags: string[];
  hrefFor: (tag: string) => string;
  locale: Locale;
}) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label={messages[locale].tags.label} className={styles.tags}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={hrefFor(tag)} className={styles.link}>
            <span aria-hidden="true">#</span>
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
