import { LanguageLabel } from "./language-label";
import styles from "./post-meta.module.css";

// The publication date (UTC, YYYY-MM-DD) and language label of a post.
export function PostMeta({
  publishedAt,
  language,
}: {
  publishedAt: Date;
  language: React.ComponentProps<typeof LanguageLabel>["language"];
}) {
  return (
    <p className={styles.meta}>
      <time dateTime={publishedAt.toISOString()}>
        {publishedAt.toISOString().slice(0, 10)}
      </time>
      <LanguageLabel language={language} />
    </p>
  );
}
