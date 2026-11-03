/**
 * Changed lines chosen in a working tree diff, and turning them (or a hunk) into the ranges the
 * backend stages, unstages or discards. A removed line is named by its number in the old
 * version, an added line by its number in the new one.
 */
import type { DiffLineDto, LineRangeDto, SplitCellDto } from "@/shared/ipc/bindings";

/** `o12`: removed line 12 of the old version; `n14`: added line 14 of the new one. */
export type LineKey = `o${number}` | `n${number}`;

/** The key of a unified row, if it is a changed line. */
export function keyOfRow(line: DiffLineDto | undefined): LineKey | undefined {
  if (line?.kind === "removed" && line.oldLine !== null) return `o${line.oldLine}`;
  if (line?.kind === "added" && line.newLine !== null) return `n${line.newLine}`;
  return undefined;
}

/** The key of one half of a side-by-side row, if it is a changed line. */
export function keyOfCell(cell: SplitCellDto | null | undefined): LineKey | undefined {
  if (cell?.kind === "removed") return `o${cell.line}`;
  if (cell?.kind === "added") return `n${cell.line}`;
  return undefined;
}

/** Sorted numbers as ranges: 1, 2, 3, 7 → 1–3, 7–7. */
export function toRanges(numbers: readonly number[]): LineRangeDto[] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: LineRangeDto[] = [];
  for (const number of sorted) {
    const last = ranges.at(-1);
    if (last && number <= last.end + 1) last.end = Math.max(last.end, number);
    else ranges.push({ start: number, end: number });
  }
  return ranges;
}

/** Chosen lines, split by version. */
export interface ChosenLines {
  removed: LineRangeDto[];
  added: LineRangeDto[];
}

/** The chosen keys as ranges of each version. */
export function chosenLines(keys: Iterable<LineKey>): ChosenLines {
  const removed: number[] = [];
  const added: number[] = [];
  for (const key of keys) {
    const number = Number(key.slice(1));
    if (key.startsWith("o")) removed.push(number);
    else added.push(number);
  }
  return { removed: toRanges(removed), added: toRanges(added) };
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** A side of a hunk header (`12,3` or `12`) as lines; none for an empty side (`12,0`). */
function side(start: string, length: string | undefined): LineRangeDto[] {
  const count = length === undefined ? 1 : Number(length);
  const first = Number(start);
  return count === 0 ? [] : [{ start: first, end: first + count - 1 }];
}

/** Every line of the hunk whose header is `text` (`@@ -1,3 +1,4 @@`); `null` if unreadable. */
export function hunkLines(text: string): ChosenLines | null {
  const match = HUNK_HEADER.exec(text);
  if (!match) return null;
  const [, oldStart = "0", oldLength, newStart = "0", newLength] = match;
  return { removed: side(oldStart, oldLength), added: side(newStart, newLength) };
}

/** "3 lines" / "1 line". */
export function lineCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "line" : "lines"}`;
}
