import Link from "next/link";
import styles from "./site-frame.module.css";

// The frame of every public page: header with the site name, a content
// column, and a footer.
export function SiteFrame({
  siteName,
  homeHref,
  children,
}: {
  siteName: string;
  homeHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.siteName}>
          {siteName}
        </Link>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} {siteName}
      </footer>
    </div>
  );
}
