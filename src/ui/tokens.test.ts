import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Form controls must stay findable: WCAG 2.2 non-text contrast asks for 3:1
// between a control's outline and the colors next to it. Controls are filled
// with the surface color and sit on a card (surface) or the page.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const schemes = [
  ["light", css.slice(0, darkStart)],
  ["dark", css.slice(darkStart)],
] as const;

function token(block: string, name: string): string {
  const value = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!value?.[1]) throw new Error(`--${name} is not defined`);
  return value[1];
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

describe.each(schemes)("control border in the %s scheme", (_scheme, block) => {
  it.each(["color-surface", "color-page"])(
    "reaches 3:1 against --%s",
    (surface) => {
      const border = token(block, "color-border-control");
      expect(contrast(border, token(block, surface))).toBeGreaterThanOrEqual(3);
    },
  );
});
