/**
 * What a remote fetches, as people think of it: every branch, chosen branches or patterns
 * (`main`, `release/*`), or something else written by hand (edited in the Advanced tab).
 * Chosen branches become one refspec each: `+refs/heads/<b>:refs/remotes/<name>/<b>`.
 */

export type FetchChoice =
  { kind: "all" } | { kind: "chosen"; branches: string[] } | { kind: "custom" };

export function everyBranch(remote: string): string {
  return `+refs/heads/*:refs/remotes/${remote}/*`;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How `refspecs` (the remote's `fetch` values) read. None reads as chosen with no branch. */
export function readFetch(remote: string, refspecs: readonly string[]): FetchChoice {
  if (refspecs.length === 1 && refspecs[0] === everyBranch(remote)) return { kind: "all" };
  // `(.*)`: a branch being typed in is still empty, and stays in the list.
  const one = new RegExp(`^\\+?refs/heads/(.*):refs/remotes/${escape(remote)}/(.*)$`);
  const branches: string[] = [];
  for (const refspec of refspecs) {
    const match = one.exec(refspec);
    const branch = match?.[1];
    if (branch === undefined || branch !== match?.[2] || branch === "*") return { kind: "custom" };
    branches.push(branch);
  }
  return { kind: "chosen", branches };
}

/** The refspecs fetching `branches` (names or patterns with one `*`). */
export function chosenRefspecs(remote: string, branches: readonly string[]): string[] {
  return branches.map((branch) => `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`);
}

/** Why `branch` cannot be a branch name or pattern to fetch, or null. */
export function branchPatternProblem(branch: string): string | null {
  if (branch.trim() === "") return "A branch is empty: fill it in or remove it.";
  if (/\s/.test(branch)) return `“${branch}” has a space; branch names cannot.`;
  if ((branch.match(/\*/g) ?? []).length > 1) return `“${branch}” has more than one “*”.`;
  if (/\.\.|[~^:?[\\]|@\{/.test(branch) || branch.startsWith("-") || branch.startsWith("/")) {
    return `“${branch}” cannot be a branch name.`;
  }
  return null;
}
