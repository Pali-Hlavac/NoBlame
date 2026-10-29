/** Splits a line into plain and changed parts for word highlighting. */

export interface Segment {
  text: string;
  changed: boolean;
}

/**
 * `text` cut at the `[start, end)` ranges (UTF-16 offsets, sorted, from the backend). Ranges
 * outside the text are clipped, so a cut line still renders.
 */
export function segments(
  text: string,
  highlights: readonly (readonly [number, number])[],
): Segment[] {
  const parts: Segment[] = [];
  let position = 0;
  for (const [rawStart, rawEnd] of highlights) {
    const start = Math.max(position, Math.min(rawStart, text.length));
    const end = Math.min(rawEnd, text.length);
    if (end <= start) continue;
    if (start > position) parts.push({ text: text.slice(position, start), changed: false });
    parts.push({ text: text.slice(start, end), changed: true });
    position = end;
  }
  if (position < text.length || parts.length === 0) {
    parts.push({ text: text.slice(position), changed: false });
  }
  return parts;
}
