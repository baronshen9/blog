import styles from "./prose.module.css";

// Rendered Markdown in the reading typography. `html` must come from
// renderMarkdown, which sanitizes it.
export function Prose({ html }: { html: string }) {
  return (
    <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
