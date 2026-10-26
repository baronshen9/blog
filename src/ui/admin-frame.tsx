import Link from "next/link";
import styles from "./admin-frame.module.css";

// The frame of the signed-in admin: a dark top bar with navigation and
// sign-out above a full-width work area.
export function AdminFrame({
  siteName,
  signOutAction,
  children,
}: {
  siteName: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <span className={styles.brand}>{siteName} · Admin</span>
        <nav aria-label="Admin" className={styles.nav}>
          <Link href="/admin">Posts</Link>
          <Link href="/admin/posts/new">New post</Link>
        </nav>
        <form action={signOutAction}>
          <button type="submit" className={styles.signOut}>
            Sign out
          </button>
        </form>
      </header>
      <div className={styles.work}>{children}</div>
    </div>
  );
}
