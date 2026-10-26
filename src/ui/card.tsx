import Link from "next/link";
import styles from "./card.module.css";

// The card that holds the main content of a page: a back link, the title, an
// optional line below it (such as PostMeta), and the body.
export function Card({
  title,
  backHref,
  backLabel,
  meta,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.card}>
      <Link href={backHref} className={styles.back}>
        <span aria-hidden="true">← </span>
        {backLabel}
      </Link>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {meta}
      </header>
      {children}
    </article>
  );
}
