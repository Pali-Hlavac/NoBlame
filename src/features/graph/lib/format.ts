/** Text formatting for graph columns. */

/** Characters of the commit id shown in the hash column. */
export const SHORT_ID_LENGTH = 8;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Local date and time of a commit, from seconds since the epoch (`null`: unknown). */
export function formatCommitDate(seconds: number | null): string {
  return seconds === null ? "" : dateFormat.format(new Date(seconds * SECOND_MS));
}

const SECOND_MS = 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
/** Steps of relative dates (in seconds): below `below`, count whole `unit`s. */
const RELATIVE_STEPS: readonly { below: number; unit: number; suffix: string }[] = [
  { below: HOUR, unit: MINUTE, suffix: "min" },
  { below: DAY, unit: HOUR, suffix: "h" },
  { below: MONTH, unit: DAY, suffix: "d" },
  { below: YEAR, unit: MONTH, suffix: "mo" },
  { below: Infinity, unit: YEAR, suffix: "y" },
];

/**
 * How long ago a commit was made: "just now", "5 min ago", "3 h ago", "2 d ago", "4 mo ago",
 * "6 y ago". A time in the future (a skewed clock) shows the date instead.
 */
export function formatRelativeDate(seconds: number | null, nowMs: number): string {
  if (seconds === null) return "";
  const elapsed = Math.floor(nowMs / SECOND_MS - seconds);
  if (elapsed < 0) return formatCommitDate(seconds);
  const step = RELATIVE_STEPS.find((each) => elapsed < each.below);
  if (!step || elapsed < MINUTE) return "just now";
  return `${Math.floor(elapsed / step.unit)} ${step.suffix} ago`;
}

/** Abbreviated commit id. */
export function shortId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH);
}

const counts = new Intl.NumberFormat("en-US");

/** "1,234 of 5,678 commits" for a filtered tab. */
export function formatShownCommits(shown: number, total: number): string {
  return `${counts.format(shown)} of ${counts.format(total)} commits`;
}
