import type { Language } from "@/server/posts";

// Where the language switch leads from the public page at `pathname`, as far
// as the URL tells: the same list in each language — home, a tag page, or a
// search with its words — and otherwise, such as from a post, that language's
// home page. Paging starts over, since the lists of two languages differ. A
// page that knows better, such as a not-found tag page, overrides it with
// `SwitchTo`.
export function languageHrefs(
  pathname: string,
  query: URLSearchParams,
): Record<Language, string> {
  const [, , ...rest] = pathname.split("/");
  const path = equivalentPath(rest, query);
  return { zh: `/zh${path}`, en: `/en${path}` };
}

function equivalentPath(rest: string[], query: URLSearchParams): string {
  const [section, name] = rest;
  if (rest.length === 1 && section === "search") {
    const words = query.get("q");
    return words ? `/search?${new URLSearchParams({ q: words })}` : "/search";
  }
  if (rest.length === 2 && section === "tags" && name) return `/tags/${name}`;
  return "";
}
