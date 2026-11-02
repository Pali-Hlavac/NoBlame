/** Text shown around a diff: sizes, counts, the tab title and why a diff is empty. */
import type { WhitespaceMode } from "@/shared/ipc/bindings";

import type { DiffFile } from "./diffFile";

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

/** Why a changed file has no rows. */
export function unchangedText(file: DiffFile, whitespace: WhitespaceMode): string {
  if (file.oldId === file.newId) {
    return file.previousPath
      ? "The file was moved; its contents did not change."
      : "Only the file mode changed (for example the executable bit).";
  }
  if (file.oldId && file.newId && whitespace !== "show") {
    return "Only whitespace changed, and the whitespace option above hides it.";
  }
  return file.status === "added" || file.status === "untracked"
    ? "The new file is empty."
    : "The removed file was empty.";
}
