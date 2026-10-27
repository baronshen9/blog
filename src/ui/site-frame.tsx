import Link from "next/link";
import { SearchForm } from "./search-form";
import styles from "./site-frame.module.css";

// The frame of every public page: header with the site name and the search
// box, a content column, and a footer.
export function SiteFrame({
  siteName,
  homeHref,
  searchHref,
  children,
}: {
  siteName: string;
  homeHref: string;
  searchHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.siteName}>
          {siteName}
        </Link>
        <SearchForm action={searchHref} />
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} {siteName}
      </footer>
    </div>
  );
}
