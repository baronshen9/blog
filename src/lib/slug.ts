const maxLength = 80;

// Lowercase Latin letters and digits joined by hyphens, with accents removed;
// empty when the text has none, such as a Chinese title.
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}
