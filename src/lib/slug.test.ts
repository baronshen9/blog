import { expect, test } from "vitest";
import { slugify } from ".";

test.each([
  ["Hello, World!", "hello-world"],
  ["Café déjà vu", "cafe-deja-vu"],
  ["Next.js 16 入门", "next-js-16"],
  ["你好世界", ""],
])("slugify(%j) is %j", (title, slug) => {
  expect(slugify(title)).toBe(slug);
});
