/**
 * The theme's colours against WCAG 2.2 contrast: text 4.5:1 on what it is drawn on, lines and
 * icons that carry meaning 3:1 (1.4.11). Reads the tokens of both themes from `styles.css`, so a
 * colour changed there is checked here. Borders and the soft fills behind selected rows are
 * decorative and not checked.
 */
import { readFileSync } from "node:fs";

// Read from disk (Vitest hands CSS imports over empty), from the project root Vitest runs in.
const css = readFileSync("src/app/styles.css", "utf8");

const TEXT = 4.5;
const GRAPHIC = 3;

/** The `--name: oklch(...)` tokens of one block (`:root` or `.dark`). */
function tokens(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const found = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)) {
    const [, name, value] = match;
    if (name && value) found.set(name, value);
  }
  return found;
}

/** Relative luminance of an `oklch(L C H)` colour (gamut-clipped sRGB). */
function luminance(oklch: string): number {
  const [l = 0, c = 0, h = 0] = (/oklch\(([^)]*)\)/.exec(oklch)?.[1] ?? "")
    .trim()
    .split(/\s+/)
    .map(Number);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ].map((channel) => Math.min(1, Math.max(0, channel)));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Text tokens and what they are drawn on. */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "popover"],
  ["muted-foreground", "accent"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["primary", "background"],
  ["destructive", "background"],
  ["warning", "background"],
  ["success", "background"],
  ["ref-branch-foreground", "ref-branch"],
  ["ref-remote-foreground", "ref-remote"],
  ["ref-tag-foreground", "ref-tag"],
  ...["added", "modified", "deleted", "renamed"].map(
    (status) => [`status-${status}`, "background"] as const,
  ),
  ...["diff-added", "diff-removed", "diff-hunk", "diff-added-word", "diff-removed-word"].map(
    (fill) => ["foreground", fill] as const,
  ),
  ...["comment", "string", "keyword", "constant", "type", "function", "tag", "attribute"].flatMap(
    (kind) =>
      ["background", "diff-added", "diff-removed"].map((fill) => [`syntax-${kind}`, fill] as const),
  ),
];

/** Lines and icons that carry meaning, on the background. */
const GRAPHIC_TOKENS: readonly string[] = [
  "ring",
  "primary",
  ...Array.from({ length: 8 }, (_, lane) => `lane-${String(lane)}`),
  "ref-head",
  "merge-ours",
  "merge-theirs",
  "merge-both",
  ...["commit", "stash", "history", "branches", "repositories", "groups", "submodules"].map(
    (kind) => `kind-${kind}`,
  ),
];

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("the %s theme", (_name, selector) => {
  const theme = tokens(selector);
  // The dark block only overrides; anything it leaves out comes from `:root`.
  const colour = (name: string): string => {
    const value = theme.get(name) ?? tokens(":root").get(name);
    if (!value) throw new Error(`No colour --${name}`);
    return value;
  };

  it.each(TEXT_PAIRS)("--%s on --%s is readable text", (text, fill) => {
    expect(contrast(colour(text), colour(fill))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(GRAPHIC_TOKENS)("--%s stands out from the background", (token) => {
    expect(contrast(colour(token), colour("background"))).toBeGreaterThanOrEqual(GRAPHIC);
  });
});
