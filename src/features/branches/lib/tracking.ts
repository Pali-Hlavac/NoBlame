/** How a local branch relates to its upstream, in words and as the row shows it. */

/** A branch's upstream and, once counted, how far apart they are. */
export interface BranchTracking {
  /** The upstream's full name (`refs/remotes/origin/main`, `refs/heads/main`). */
  upstream: string;
  /** Configured but missing (deleted on the remote, or never fetched). */
  gone: boolean;
  /** Commits to push and to pull; absent until counted. */
  counts?: { ahead: number; behind: number };
}

const UPSTREAM_PREFIXES = ["refs/remotes/", "refs/heads/"];

/** The upstream as the user knows it: `origin/main`, or `main` for a local branch. */
export function upstreamName(full: string): string {
  for (const prefix of UPSTREAM_PREFIXES) {
    if (full.startsWith(prefix)) return full.slice(prefix.length);
  }
  return full;
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

/** A sentence for tooltips and screen readers: "Tracks origin/main: 2 commits to push". */
export function trackingText(tracking: BranchTracking): string {
  const name = upstreamName(tracking.upstream);
  if (tracking.gone) return `Its upstream ${name} is gone`;
  const { counts } = tracking;
  if (!counts) return `Tracks ${name}`;
  const parts = [
    ...(counts.ahead > 0 ? [`${plural(counts.ahead, "commit")} to push`] : []),
    ...(counts.behind > 0 ? [`${plural(counts.behind, "commit")} to pull`] : []),
  ];
  return parts.length === 0 ? `Up to date with ${name}` : `Tracks ${name}: ${parts.join(", ")}`;
}

/** Branch names to choose an upstream from. */
export interface UpstreamChoices {
  branches: ReadonlySet<string>;
  remotes: ReadonlySet<string>;
}

/**
 * The full name of the upstream typed as `name` (`origin/main` or a local `main`), or null
 * when no such branch exists. A remote branch wins over a local branch of the same name.
 */
export function upstreamRef(name: string, choices: UpstreamChoices): string | null {
  if (choices.remotes.has(name)) return `refs/remotes/${name}`;
  if (choices.branches.has(name)) return `refs/heads/${name}`;
  return null;
}

/** Why `name` cannot be the upstream of `branch`, or null. */
export function upstreamProblem(
  name: string,
  branch: string,
  choices: UpstreamChoices,
): string | null {
  if (name === "") return "Enter a remote branch, such as origin/main.";
  if (name === branch && !choices.remotes.has(name)) return "A branch cannot track itself.";
  return upstreamRef(name, choices) === null ? `There is no branch “${name}”.` : null;
}

/** What the dialog starts with: the current upstream, else `<remote>/<branch>` if one exists. */
export function suggestedUpstream(
  branch: string,
  current: string | null,
  remotes: ReadonlySet<string>,
): string {
  if (current !== null) return upstreamName(current);
  // `origin/feature/x` is not the same name as `x`: compare what follows the remote.
  const sameName = [...remotes]
    .filter((name) => name.slice(name.indexOf("/") + 1) === branch)
    .sort();
  return sameName.find((name) => name.startsWith("origin/")) ?? sameName[0] ?? "";
}
