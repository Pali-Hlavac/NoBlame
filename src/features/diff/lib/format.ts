/** Text shown around a diff: sizes, counts and the tab title. */

const BYTES_PER_UNIT = 1024;
const UNITS = ["KB", "MB", "GB"] as const;

const counts = new Intl.NumberFormat("en-US");
const decimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** "0 bytes", "1 byte", "900 bytes", "1.5 KB", "64 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_UNIT) return bytes === 1 ? "1 byte" : `${counts.format(bytes)} bytes`;
  let value = bytes;
  let unit: string = UNITS[0];
  for (const next of UNITS) {
    value /= BYTES_PER_UNIT;
    unit = next;
    if (value < BYTES_PER_UNIT) break;
  }
  return `${decimals.format(value)} ${unit}`;
}

/** "+12 −3" (a real minus sign, as in most diff tools). */
export function formatChangeCounts(additions: number, deletions: number): string {
  return `+${counts.format(additions)} −${counts.format(deletions)}`;
}

/** "Diff: main.rs", or "Diff" when no file is chosen. */
export function diffTabTitle(path: string | undefined): string {
  if (!path) return "Diff";
  return `Diff: ${path.slice(path.lastIndexOf("/") + 1)}`;
}

/** Characters needed for the largest line number (at least 3, so short files line up too). */
export function gutterDigits(oldLines: number, newLines: number): number {
  return Math.max(3, String(Math.max(oldLines, newLines)).length);
}
