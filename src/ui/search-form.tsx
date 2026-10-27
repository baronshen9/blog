import styles from "./search-form.module.css";

// The search box in the header of every public page; it submits the words as
// ?q= to the search page at `action`.
export function SearchForm({ action }: { action: string }) {
  return (
    <form role="search" action={action} className={styles.form}>
      <input
        type="search"
        name="q"
        aria-label="Search posts"
        placeholder="Search posts"
        className={styles.input}
      />
      <button type="submit" className={styles.button}>
        Search
      </button>
    </form>
  );
}
