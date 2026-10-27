// Tag names are compared in one canonical spelling: compatibility forms
// unified (full-width letters and punctuation become their usual forms),
// lowercase, and every run of spaces, underscores, and hyphens one hyphen,
// with none at either end. "Next JS", "next_js", and "ＮＥＸＴ－ＪＳ" are all
// "next-js".
export function normalizeTag(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_-]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export const maxTagLength = 40;

// A canonical tag name: letters (of any script) and digits joined by single
// hyphens, at most maxTagLength characters.
export function isTag(text: string): boolean {
  return (
    [...text].length <= maxTagLength &&
    /^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(-[\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u.test(
      text,
    )
  );
}
