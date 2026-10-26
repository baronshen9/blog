import Link from "next/link";
import styles from "./admin-frame.module.css";

const sections = [
  { id: "posts", href: "/admin", label: "Posts" },
  { id: "new-post", href: "/admin/posts/new", label: "New post" },
] as const;

type AdminSection = (typeof sections)[number]["id"];

// The frame of the signed-in admin: a dark top bar with navigation and
// sign-out above a full-width work area. `current` marks the section the
// page belongs to.
export function AdminFrame({
  siteName,
  current,
  signOutAction,
  children,
}: {
  siteName: string;
  current: AdminSection;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <span className={styles.brand}>{siteName} · Admin</span>
        <nav aria-label="Admin" className={styles.nav}>
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              aria-current={section.id === current ? "page" : undefined}
            >
              {section.label}
            </Link>
          ))}
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
