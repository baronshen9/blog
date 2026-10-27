// The tag pages of a language: tagHref(locale)(tag) is the URL of the page
// listing the published posts with the tag.
export function tagHref(locale: string): (tag: string) => string {
  return (tag) => `/${locale}/tags/${encodeURIComponent(tag)}`;
}
