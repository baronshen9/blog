import styles from "./page-title.module.css";

// The heading of a page whose content is a list rather than one card, with
// an optional line below it and the page's main actions beside it.
export function PageTitle({
  children,
  description,
  actions,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const title = <h1 className={styles.title}>{children}</h1>;
  if (!description && !actions) return title;
  return (
    <header className={styles.header}>
      <div>
        {title}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
