import Link from "next/link";
import type { Locale } from "@/messages";
import { LanguageSwitch } from "./language-switch";
import { SearchForm } from "./search-form";
import styles from "./site-frame.module.css";

// The frame of every public page in `locale`: header with the site name, the
// search box, and the language switch, a content column, and a footer.
export function SiteFrame({
  siteName,
  locale,
  languageHrefs,
  children,
}: {
  siteName: string;
  locale: Locale;
  languageHrefs: Record<Locale, string>;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href={`/${locale}`} className={styles.siteName}>
          {siteName}
        </Link>
        <div className={styles.search}>
          <SearchForm action={`/${locale}/search`} locale={locale} />
        </div>
        <LanguageSwitch locale={locale} hrefs={languageHrefs} />
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} {siteName}
      </footer>
    </div>
  );
}
