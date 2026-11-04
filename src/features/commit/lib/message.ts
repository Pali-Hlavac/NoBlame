/** Checks on the commit message and the author override, before git sees them. */

/** A summary longer than this is long (the common convention). */
export const SUMMARY_SOFT_LIMIT = 50;
/** A summary longer than this gets cut off by many tools (and by git's own one-line formats). */
export const SUMMARY_HARD_LIMIT = 72;

/** Splits text into what people see as characters (grapheme clusters). */
const CHARACTERS = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** How the summary line measures up. */
export interface SummaryCheck {
  /** Characters in the summary, as people count them (an emoji is one). */
  length: number;
  /** `ok` up to the soft limit, `long` up to the hard limit, `too-long` beyond. */
  level: "ok" | "long" | "too-long";
  /** The line after the summary has text: git would take it as part of the summary. */
  secondLineUsed: boolean;
}

/** The message without lines starting with `commentChar`, as `--cleanup=strip` removes them. */
export function withoutComments(message: string, commentChar: string): string {
  return message
    .split("\n")
    .filter((line) => !line.startsWith(commentChar))
    .join("\n");
}

/**
 * Measures the summary: the first line with text (git drops blank lines before it). Pass the
 * message as git will store it (`withoutComments` when the template's comments go).
 */
export function checkSummary(message: string): SummaryCheck {
  const lines = message.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first === -1) return { length: 0, level: "ok", secondLineUsed: false };
  const length = [...CHARACTERS.segment((lines[first] ?? "").trimEnd())].length;
  const level =
    length > SUMMARY_HARD_LIMIT ? "too-long" : length > SUMMARY_SOFT_LIMIT ? "long" : "ok";
  return { length, level, secondLineUsed: (lines[first + 1] ?? "").trim() !== "" };
}

/**
 * Whether `text` is an author git takes as given: `Name <email>`, both parts present, no angle
 * brackets or line breaks inside (the backend checks the same).
 */
export function isAuthor(text: string): boolean {
  return /^[^<>\r\n]*[^<>\s][^<>\r\n]*<\s*[^<>\s][^<>\r\n]*>$/.test(text.trim());
}
