import Link from "next/link";
import { messages, type Locale } from "@/messages";
import styles from "./language-switch.module.css";

// Each language's name in that language, in the order the switch shows them.
const names: Record<Locale, string> = { zh: "中文", en: "English" };

// The header's choice of interface language: the current language marked,
// the other one a link to `hrefs[language]`.
export function LanguageSwitch({
  locale,
  hrefs,
}: {
  locale: Locale;
  hrefs: Record<Locale, string>;
}) {
  return (
    <nav aria-label={messages[locale].languageSwitch}>
      <ul className={styles.switch}>
        {(Object.keys(names) as Locale[]).map((language) => (
          <li key={language}>
            {language === locale ? (
              <span
                lang={language}
                aria-current="true"
                className={`${styles.option} ${styles.current}`}
              >
                {names[language]}
              </span>
            ) : (
              <Link
                href={hrefs[language]}
                lang={language}
                hrefLang={language}
                className={styles.option}
              >
                {names[language]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
