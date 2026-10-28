import { expect, test } from "vitest";
import { languageHrefs } from "./language-hrefs";

test.each([
  ["/en", "", "/zh", "/en"],
  ["/en", "page=2", "/zh", "/en"],
  [
    "/zh/search",
    "q=数据库&page=3",
    "/zh/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93",
    "/en/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93",
  ],
  ["/en/search", "", "/zh/search", "/en/search"],
  [
    "/en/tags/%E6%A0%87%E7%AD%BE",
    "page=2",
    "/zh/tags/%E6%A0%87%E7%AD%BE",
    "/en/tags/%E6%A0%87%E7%AD%BE",
  ],
  ["/zh/posts/hello", "", "/zh", "/en"],
  ["/en/no/such/page", "", "/zh", "/en"],
  ["/fr/x", "", "/zh", "/en"],
])("the switch on %s?%s leads to %s and %s", (pathname, query, zh, en) => {
  expect(languageHrefs(pathname, new URLSearchParams(query))).toEqual({
    zh,
    en,
  });
});
