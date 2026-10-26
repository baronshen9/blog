import styles from "./notice.module.css";

// The outcome of a form submission: an error is announced at once, a success
// politely.
export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`${styles.notice} ${styles[tone]}`}
    >
      {children}
    </p>
  );
}
