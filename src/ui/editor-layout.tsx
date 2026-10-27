import Link from "next/link";
import styles from "./editor-layout.module.css";

// The post editor: title and status on top, then the language and the
// post's public address, the Markdown and its preview side by side (stacked
// below 900 px), and the form's messages and actions at the bottom. The
// layout labels the controls it is given. `preview` is the rendered body,
// absent until the owner asks for it. The address is either fixed, linking to
// the post when it is live, or a prefix followed by the control that edits the
// slug.
export function EditorLayout({
  heading,
  title,
  status,
  language,
  address,
  markdown,
  preview,
  messages,
  actions,
}: {
  heading: string;
  title: React.ReactNode;
  status?: React.ReactNode;
  language: React.ReactNode;
  address?:
    { path: string; live: boolean } | { prefix: string; slug: React.ReactNode };
  markdown: React.ReactNode;
  preview?: React.ReactNode;
  messages?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className={styles.editor}>
      <h1 className={styles.hidden}>{heading}</h1>
      <div className={styles.head}>
        <label className={styles.title}>
          <span className={styles.hidden}>Title</span>
          {title}
        </label>
        {status && (
          <p className={styles.status}>
            <span className={styles.hidden}>Status: </span>
            {status}
          </p>
        )}
      </div>
      <div className={styles.meta}>
        <label className={styles.language}>
          <span>Language</span>
          {language}
        </label>
        {address && "path" in address && (
          <>
            <code className={styles.path}>{address.path}</code>
            {address.live && <Link href={address.path}>View post</Link>}
          </>
        )}
        {address && "slug" in address && (
          <div className={styles.slug}>
            <code className={styles.prefix}>{address.prefix}</code>
            <label>
              <span className={styles.hidden}>Slug</span>
              {address.slug}
            </label>
          </div>
        )}
      </div>
      <div className={styles.panes}>
        <label className={styles.markdown}>
          <span className={styles.hidden}>Body (Markdown)</span>
          {markdown}
        </label>
        <section aria-label="Preview" className={styles.preview}>
          <h2 className={styles.paneLabel}>Preview</h2>
          {preview ?? (
            <p className={styles.placeholder}>
              Select Preview to see the rendered body.
            </p>
          )}
        </section>
      </div>
      <div className={styles.footer}>
        <div className={styles.messages}>{messages}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}
