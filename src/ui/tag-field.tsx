"use client";

import { useId, useState, type KeyboardEvent } from "react";
import styles from "./tag-field.module.css";

// Edits a list of tags inside a form: each tag is a chip with a remove button
// and travels as one `name` value. Typing a name and pressing Enter or a comma
// adds it, as does leaving the input; text with commas adds several. The
// server normalizes and validates the names; this field only collects them.
export function TagField({
  label,
  name,
  defaultValue,
  disabled = false,
}: {
  label: string;
  name: string;
  defaultValue: string[];
  disabled?: boolean;
}) {
  const [tags, setTags] = useState(defaultValue);
  const [text, setText] = useState("");
  const labelId = useId();

  function add() {
    const added = text
      .split(/[,，、]/)
      .map((part) => part.trim())
      .filter((part) => part && !tags.includes(part));
    if (added.length) setTags([...tags, ...new Set(added)]);
    setText("");
  }

  // Enter adds the tag rather than submitting the form; it does nothing while
  // an input method is still composing the text.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.control}>
        {tags.length > 0 && (
          <ul className={styles.tags} aria-labelledby={labelId}>
            {tags.map((tag) => (
              <li key={tag} className={styles.tag}>
                <input type="hidden" name={name} value={tag} />
                {tag}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          className={styles.input}
          aria-labelledby={labelId}
          value={text}
          placeholder="Add a tag"
          readOnly={disabled}
          autoCapitalize="none"
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      </div>
    </div>
  );
}
