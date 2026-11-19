/** The shape of the remote editor's settings registry, its tabs and git versions. */

/** The editor's tabs, in order. */
export const REMOTE_TABS = [
  { id: "general", label: "General" },
  { id: "fetch", label: "Fetch" },
  { id: "push", label: "Push" },
  { id: "branches", label: "Branches" },
  { id: "advanced", label: "Advanced" },
] as const;

export type RemoteTab = (typeof REMOTE_TABS)[number]["id"];

export function tabLabel(tab: RemoteTab): string {
  return REMOTE_TABS.find((candidate) => candidate.id === tab)?.label ?? tab;
}

/** A git version as major and minor. */
export type GitRelease = readonly [major: number, minor: number];

export interface RemoteSetting {
  readonly id: string;
  readonly tab: RemoteTab;
  readonly label: string;
  /** What it does, in plain words. */
  readonly help: string;
  /** Its git key for the remote `name`; null when it is not a setting (the name). */
  readonly key: ((name: string) => string) | null;
  /** Other words that find it. */
  readonly synonyms: readonly string[];
  /** The oldest git that knows it. */
  readonly since?: GitRelease;
  /** It applies to every remote of the repository, not only this one. */
  readonly repositoryWide?: boolean;
}

/** `[2, 56]` from a version like `2.56.0` or `2.56.0.windows.2`; null when unreadable. */
export function gitRelease(version: string | undefined): GitRelease | null {
  const match = /^(\d+)\.(\d+)/.exec(version ?? "");
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Whether git `release` knows a setting that came with `since`. Unknown versions are let be. */
export function supports(release: GitRelease | null, since: GitRelease | undefined): boolean {
  if (!since || !release) return true;
  return release[0] > since[0] || (release[0] === since[0] && release[1] >= since[1]);
}
