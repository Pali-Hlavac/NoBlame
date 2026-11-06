/** Remote branch names and the remotes they belong to. */

/** A branch on a remote: `origin` and `feature/x` for `origin/feature/x`. */
export interface RemoteBranch {
  remote: string;
  branch: string;
}

/**
 * Splits a remote branch's short name (`origin/feature/x`) by the longest remote name that
 * prefixes it (remote names may contain `/`); null when no remote matches.
 */
export function splitRemoteBranch(name: string, remotes: readonly string[]): RemoteBranch | null {
  const remote = remotes
    .filter((candidate) => name.startsWith(`${candidate}/`))
    .reduce<string | null>(
      (longest, candidate) =>
        longest === null || candidate.length > longest.length ? candidate : longest,
      null,
    );
  return remote === null ? null : { remote, branch: name.slice(remote.length + 1) };
}

/** The remote and branch of an upstream's full name; null for a local upstream (`refs/heads/`). */
export function upstreamOnRemote(
  upstream: string,
  remotes: readonly string[],
): RemoteBranch | null {
  const prefix = "refs/remotes/";
  return upstream.startsWith(prefix)
    ? splitRemoteBranch(upstream.slice(prefix.length), remotes)
    : null;
}

/** The remote to offer first: `preferred` if it exists, else `origin`, else the first one. */
export function defaultRemote(remotes: readonly string[], preferred?: string): string | undefined {
  if (preferred !== undefined && remotes.includes(preferred)) return preferred;
  return remotes.includes("origin") ? "origin" : remotes[0];
}
