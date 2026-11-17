/** Splitting the third-party notices (`pnpm licences`) into parts that can be searched. */

/** The line between two licences in the notices file. */
const RULE = /^={20,}$/m;

/** The notices' sections: the introduction, then one per licence text and the parts after. */
export function noticeSections(text: string): string[] {
  return text
    .split(RULE)
    .map((section) => section.trim())
    .filter(Boolean);
}

/** The sections mentioning every word of `query` (any case); all of them for an empty one. */
export function matchingSections(sections: readonly string[], query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...sections];
  return sections.filter((section) => {
    const lower = section.toLowerCase();
    return words.every((word) => lower.includes(word));
  });
}
