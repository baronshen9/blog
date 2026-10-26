import styles from "./field.module.css";

// A labelled input, select, or textarea, with an optional error below it.
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.control}>
        <span className={styles.label}>{label}</span>
        {children}
      </label>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
