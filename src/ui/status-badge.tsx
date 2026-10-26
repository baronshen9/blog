import styles from "./status-badge.module.css";

const labels = { draft: "Draft", published: "Published" } as const;

export function StatusBadge({ status }: { status: keyof typeof labels }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
