/** Splits a line into parts by changed words and syntax colours. */
import type { SyntaxClassDto } from "@/shared/ipc/bindings";

export interface Segment {
  text: string;
  /** Part of a changed word. */
  changed: boolean;
  /** Syntax colour, if any. */
  syntax: SyntaxClassDto | undefined;
}

/** `[start, end)` in UTF-16 offsets, sorted (from the backend). */
type Range = readonly [number, number];
type SyntaxRange = readonly [number, number, SyntaxClassDto];

/**
 * `text` cut wherever the changed words or the syntax colours start or end. Ranges past the
 * end of the text are clipped, so a cut line still renders.
 */
export function segments(
  text: string,
  highlights: readonly Range[],
  syntax: readonly SyntaxRange[] = [],
): Segment[] {
  const cuts = new Set([0, text.length]);
  for (const [start, end] of [...highlights, ...syntax]) {
    cuts.add(Math.min(start, text.length));
    cuts.add(Math.min(end, text.length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const parts: Segment[] = [];
  for (let index = 0; index + 1 < points.length; index++) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? start;
    if (end <= start) continue;
    const changed = highlights.some(([from, to]) => from <= start && start < to);
    const colour = syntax.find(([from, to]) => from <= start && start < to)?.[2];
    const last = parts.at(-1);
    if (last?.changed === changed && last.syntax === colour) {
      last.text += text.slice(start, end);
    } else {
      parts.push({ text: text.slice(start, end), changed, syntax: colour });
    }
  }
  return parts.length > 0 ? parts : [{ text, changed: false, syntax: undefined }];
}
