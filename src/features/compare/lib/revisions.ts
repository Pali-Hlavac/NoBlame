/** Pure helpers for the revisions the compare tab compares. */
import type { Comparison } from "@/features/selection";
import type { AheadBehindDto } from "@/shared/ipc/bindings";

/** What the compare tab shows before anything is chosen. */
export const NO_COMPARISON: Comparison = { base: "HEAD", target: "", sinceMergeBase: false };

/** Length of a commit id shown in labels, as in the graph. */
const SHORT_ID_LENGTH = 8;
const FULL_ID = /^[0-9a-f]{40}$/i;
const REF_PREFIXES = ["refs/heads/", "refs/remotes/", "refs/tags/"] as const;

/** How a revision is shown: `main` for `refs/heads/main`, a short id for a full one. */
export function revisionLabel(revision: string): string {
  const text = revision.trim();
  const prefix = REF_PREFIXES.find((start) => text.startsWith(start));
  if (prefix) return text.slice(prefix.length);
  return FULL_ID.test(text) ? text.slice(0, SHORT_ID_LENGTH) : text;
}

/** Both sides are chosen. */
export function isComplete(comparison: Comparison): boolean {
  return comparison.base.trim() !== "" && comparison.target.trim() !== "";
}

/** The comparison the other way round. */
export function swapped(comparison: Comparison): Comparison {
  return { ...comparison, base: comparison.target, target: comparison.base };
}

const counts = new Intl.NumberFormat("en-US");

function commits(count: number): string {
  return count === 1 ? "1 commit" : `${counts.format(count)} commits`;
}

/** "3 commits only in feature, 1 only in main", from the target's point of view. */
export function describeAheadBehind(
  { ahead, behind }: AheadBehindDto,
  comparison: Comparison,
): string {
  const base = revisionLabel(comparison.base);
  const target = revisionLabel(comparison.target);
  if (ahead === 0 && behind === 0) return "Same history";
  if (behind === 0) return `${commits(ahead)} only in ${target}`;
  if (ahead === 0) return `${commits(behind)} only in ${base}`;
  return `${commits(ahead)} only in ${target}, ${counts.format(behind)} only in ${base}`;
}

/** "12 files differ", and how many are listed when not all are. */
export function describeFileCount(total: number, listed: number): string {
  const files = total === 1 ? "1 file differs" : `${counts.format(total)} files differ`;
  return total > listed ? `${files} (first ${counts.format(listed)} listed)` : files;
}
