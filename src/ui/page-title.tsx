import styles from "./page-title.module.css";

// The heading of a page whose content is a list rather than one card.
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>;
}
