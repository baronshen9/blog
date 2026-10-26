import styles from "./language-label.module.css";

const labels = { zh: "中文", en: "EN" } as const;

// The compact label of a post's language.
export function LanguageLabel({ language }: { language: keyof typeof labels }) {
  return (
    <span className={styles.label} lang={language}>
      {labels[language]}
    </span>
  );
}
