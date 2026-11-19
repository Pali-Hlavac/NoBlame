/**
 * The Branches tab: local branches whose upstream is on the remote (`branch.<b>.remote` and
 * `branch.<b>.merge`, as `git branch --set-upstream-to` writes them), their push remote and
 * pull mode. A branch that stops tracking stays listed until the editor closes, so it can be
 * set back.
 */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import type { Choice } from "./choices";
import { type Draft, setValues, valuesOf } from "./draft";

const HEADS = "refs/heads/";

export function branchKey(branch: string, name: string): string {
  return `branch.${branch}.${name}`;
}

/** The local branches whose `branch.<b>.remote` names `remote`, as read or drafted, sorted. */
export function trackingBranches(base: RemoteSettingsDto, draft: Draft): string[] {
  const names = new Set<string>();
  for (const entry of base.entries) {
    const match = /^branch\.(.+)\.remote$/.exec(entry.key);
    if (match?.[1] && entry.scope === "local" && entry.value === base.name) names.add(match[1]);
  }
  for (const { key, values } of draft.keys.values()) {
    const match = /^branch\.(.+)\.remote$/i.exec(key);
    if (match?.[1] && values.includes(base.name)) names.add(match[1]);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The branch of the remote that `branch` tracks, or null. */
export function upstreamOf(base: RemoteSettingsDto, draft: Draft, branch: string): string | null {
  const [remote] = valuesOf(base, draft, branchKey(branch, "remote"));
  const [merge] = valuesOf(base, draft, branchKey(branch, "merge"));
  if (remote !== base.name || !merge) return null;
  return merge.startsWith(HEADS) ? merge.slice(HEADS.length) : merge;
}

/** `branch` tracking `upstream` on the remote, or tracking nothing (null). */
export function setUpstream(
  base: RemoteSettingsDto,
  draft: Draft,
  branch: string,
  upstream: string | null,
): Draft {
  const remote = upstream === null ? [] : [base.name];
  const merge = upstream === null ? [] : [`${HEADS}${upstream}`];
  const next = setValues(base, draft, branchKey(branch, "remote"), remote);
  return setValues(base, next, branchKey(branch, "merge"), merge);
}

/** How a branch pulls (`branch.<b>.rebase`), after "as the repository says". */
export const BRANCH_PULL_CHOICES: readonly Choice[] = [
  ["false", "Merge"],
  ["true", "Rebase"],
  ["merges", "Rebase, keeping merge commits"],
];

/** `pull.rebase` for the whole repository. */
export const PULL_REBASE_CHOICES: readonly Choice[] = [
  ["false", "Merging (a merge commit when needed)"],
  ["true", "Rebasing your commits on top"],
  ["merges", "Rebasing, keeping merge commits"],
];

/** `pull.ff` for the whole repository. */
export const PULL_FF_CHOICES: readonly Choice[] = [
  ["only", "Only fast-forward; refuse otherwise"],
  ["true", "Fast-forward when possible (git's default)"],
  ["false", "Always make a merge commit"],
];
