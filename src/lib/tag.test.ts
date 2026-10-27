import { expect, test } from "vitest";
import { isTag, normalizeTag } from ".";

test.each([
  ["TypeScript", "typescript"],
  ["  Next JS ", "next-js"],
  ["next_js", "next-js"],
  ["next -- js", "next-js"],
  ["ＮＥＸＴ－ＪＳ", "next-js"],
  ["数据库", "数据库"],
  ["-edge-", "edge"],
])("normalizeTag(%j) is %j", (text, tag) => {
  expect(normalizeTag(text)).toBe(tag);
});

test.each([
  ["typescript", true],
  ["next-js", true],
  ["数据库", true],
  ["postgres-18", true],
  ["café", true],
  ["a".repeat(40), true],
  ["a".repeat(41), false],
  ["", false],
  ["c++", false],
  ["node.js", false],
  ["a/b", false],
  ["a--b", false],
])("isTag(%j) is %j", (text, valid) => {
  expect(isTag(text)).toBe(valid);
});
