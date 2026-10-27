import { expect, test } from "vitest";
import { isSlug, slugify } from ".";

test.each([
  ["Hello, World!", "hello-world"],
  ["Café déjà vu", "cafe-deja-vu"],
  ["Next.js 16 入门", "next-js-16"],
  ["你好世界", ""],
])("slugify(%j) is %j", (title, slug) => {
  expect(slugify(title)).toBe(slug);
});

test.each([
  ["hello-world", true],
  ["next-js-16", true],
  ["a".repeat(80), true],
  ["a".repeat(81), false],
  ["", false],
  ["Hello", false],
  ["hello--world", false],
  ["-hello", false],
  ["hello-", false],
  ["hello_world", false],
  ["café", false],
  ["你好", false],
])("isSlug(%j) is %j", (text, valid) => {
  expect(isSlug(text)).toBe(valid);
});
