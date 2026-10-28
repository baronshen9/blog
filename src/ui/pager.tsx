import Link from "next/link";
import { messages, type Locale } from "@/messages";
import styles from "./pager.module.css";

// Newer and older links around the current page number of a paged list.
// Page 1 holds the newest items; a direction without a page is shown dimmed.
export function Pager({
  page,
  pageCount,
  hrefFor,
  locale,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  locale: Locale;
}) {
  const text = messages[locale].pager;
  return (
    <nav aria-label={text.label} className={styles.pager}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={styles.link}>
          <span aria-hidden="true">← </span>
          {text.newer}
        </Link>
      ) : (
        <span aria-hidden="true" className={styles.disabled}>
          ← {text.newer}
        </span>
      )}
      <span className={styles.current}>{text.current(page, pageCount)}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={styles.link}>
          {text.older}
          <span aria-hidden="true"> →</span>
        </Link>
      ) : (
        <span aria-hidden="true" className={styles.disabled}>
          {text.older} →
        </span>
      )}
    </nav>
  );
}
