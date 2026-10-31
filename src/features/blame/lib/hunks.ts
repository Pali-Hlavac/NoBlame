/** Pure helpers for blame hunks. */
import type { BlameCommitDto, BlameDto, BlameHunkDto } from "@/shared/ipc/bindings";

/** The hunk that holds line `line` (1-based); hunks are ordered by line. */
export function hunkAt(hunks: readonly BlameHunkDto[], line: number): BlameHunkDto | undefined {
  let low = 0;
  let high = hunks.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const hunk = hunks[middle];
    if (!hunk) return undefined;
    if (line < hunk.line) high = middle - 1;
    else if (line >= hunk.line + hunk.count) low = middle + 1;
    else return hunk;
  }
  return undefined;
}

/**
 * How recent each commit is, from 0 (the oldest in this blame) to 1 (the newest), by author
 * time. Recent lines get a stronger mark beside them.
 */
export function recency(commits: readonly BlameCommitDto[]): number[] {
  const times = commits.map((commit) => commit.authorTime ?? 0);
  const sorted = [...new Set(times)].sort((a, b) => a - b);
  const rank = new Map(sorted.map((time, index) => [time, index]));
  const last = Math.max(1, sorted.length - 1);
  return times.map((time) => (rank.get(time) ?? 0) / last);
}

/** Accessible description of a hunk: "Lines 5 to 9: a1b2c3d4 by Ada on 3 May 2024, Fix it". */
export function describeHunk(hunk: BlameHunkDto, commit: BlameCommitDto, date: string): string {
  const lines =
    hunk.count === 1 ? `Line ${hunk.line}` : `Lines ${hunk.line} to ${hunk.line + hunk.count - 1}`;
  return `${lines}: ${commit.id.slice(0, 8)} by ${commit.authorName} on ${date}, ${commit.summary}`;
}

/** The commit and the file's path in it for `hunk`. */
export function originOf(blame: BlameDto, hunk: BlameHunkDto) {
  return { commit: blame.commits[hunk.commit], path: blame.paths[hunk.path] };
}
