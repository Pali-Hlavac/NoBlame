/** Formatting for the Commit details module. */

const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;

const pad = (value: number): string => String(value).padStart(2, "0");

/** A time-zone offset as git writes it, e.g. `+0200` or `-0530`. */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / MINUTES_PER_HOUR))}${pad(absolute % MINUTES_PER_HOUR)}`;
}

/**
 * The signature's wall-clock time in its own time zone, like `git log --date=iso`:
 * `2026-10-27 14:03:11 +0200`. `null` (unknown time) gives an empty string.
 */
export function formatSignatureDate(seconds: number | null, offsetMinutes: number): string {
  if (seconds === null) return "";
  const local = new Date(seconds * MS_PER_SECOND + offsetMinutes * MS_PER_MINUTE);
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  return `${date} ${time} ${formatOffset(offsetMinutes)}`;
}

/** Splits a commit message into its summary line and the rest (trimmed). */
export function splitMessage(message: string): { summary: string; body: string } {
  const [summary = "", ...rest] = message.replace(/\r\n/g, "\n").split("\n");
  return { summary, body: rest.join("\n").trim() };
}
