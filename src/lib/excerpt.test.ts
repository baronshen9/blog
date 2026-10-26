import { expect, test } from "vitest";
import { excerpt } from ".";

test.each([
  ["# Title\n\nSome **bold** and `code`.", "Title Some bold and code."],
  ["Intro\n\n```js\nconst x = 1;\n```\n\n<div>raw</div>\n\nEnd", "Intro End"],
  ["![alt](/a.png) [a link](https://example.com)", "a link"],
  ["- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |", "one two a b 1 2"],
  ["line\\\nbreak", "line break"],
  ["", ""],
])("excerpt(%j) is %j", (markdown, text) => {
  expect(excerpt(markdown)).toBe(text);
});

test("cuts long text by characters, not code units", () => {
  expect(excerpt("word ".repeat(10), 12)).toBe("word word wo…");
  expect(excerpt("你好😀世界", 3)).toBe("你好😀…");
  expect(excerpt("12345", 5)).toBe("12345");
});
