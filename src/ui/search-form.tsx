import { messages, type Locale } from "@/messages";
import styles from "./search-form.module.css";

// The search box in the header of every public page; it submits the words as
// ?q= to the search page at `action`.
export function SearchForm({
  action,
  locale,
}: {
  action: string;
  locale: Locale;
}) {
  const text = messages[locale].search;
  return (
    <form role="search" action={action} className={styles.form}>
      <input
        type="search"
        name="q"
        aria-label={text.label}
        placeholder={text.label}
        className={styles.input}
      />
      <button type="submit" className={styles.button}>
        {text.submit}
      </button>
    </form>
  );
}
