import Link from "next/link";
import styles from "./pager.module.css";

// Newer and older links around the current page number of a paged list.
// Page 1 holds the newest items; a direction without a page is shown dimmed.
export function Pager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <nav aria-label="Pages" className={styles.pager}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={styles.link}>
          <span aria-hidden="true">← </span>Newer
        </Link>
      ) : (
        <span aria-hidden="true" className={styles.disabled}>
          ← Newer
        </span>
      )}
      <span className={styles.current}>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={styles.link}>
          Older<span aria-hidden="true"> →</span>
        </Link>
      ) : (
        <span aria-hidden="true" className={styles.disabled}>
          Older →
        </span>
      )}
    </nav>
  );
}
