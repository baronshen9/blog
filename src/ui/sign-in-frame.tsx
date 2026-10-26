import styles from "./sign-in-frame.module.css";

// The frame of the sign-in page: the site name above a centered card that
// holds the page's heading and form.
export function SignInFrame({
  siteName,
  title,
  children,
}: {
  siteName: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <p className={styles.siteName}>{siteName} · Admin</p>
      <main className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </main>
    </div>
  );
}
