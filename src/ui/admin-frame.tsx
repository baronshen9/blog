import Link from "next/link";
import styles from "./admin-frame.module.css";

const sections = [
  { id: "posts", href: "/admin", label: "Posts" },
  { id: "new-post", href: "/admin/posts/new", label: "New post" },
  { id: "comments", href: "/admin/comments", label: "Comments" },
  { id: "trash", href: "/admin/trash", label: "Trash" },
  { id: "tokens", href: "/admin/tokens", label: "Tokens" },
] as const;

type AdminSection = (typeof sections)[number]["id"];

// The frame of the signed-in admin: a dark top bar with navigation and
// sign-out above a full-width work area. `current` marks the section the
// page belongs to; Comments shows how many comments await moderation.
export function AdminFrame({
  siteName,
  current,
  pendingComments,
  signOutAction,
  children,
}: {
  siteName: string;
  current: AdminSection;
  pendingComments: number;
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
              {section.id === "comments" && pendingComments > 0 && (
                <span className={styles.count}>
                  {pendingComments}
                  <span className={styles.hidden}> pending</span>
                </span>
              )}
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
