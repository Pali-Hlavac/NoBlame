/**
 * Every setting the remote editor shows, in one typed list: its tab, label, help, git key and
 * the other words people search for. The tabs render from it and the search reads it, so a new
 * setting is found as soon as it is listed.
 */

/** The editor's tabs, in order. */
export const REMOTE_TABS = [
  { id: "general", label: "General" },
  { id: "advanced", label: "Advanced" },
] as const;

export type RemoteTab = (typeof REMOTE_TABS)[number]["id"];

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
}

const remoteKey = (name: string) => (remote: string) => `remote.${remote}.${name}`;

export const REMOTE_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "name",
    tab: "general",
    label: "Name",
    help: "How this repository calls the remote: its branches are listed as name/branch. Renaming moves them, and branches tracking it follow.",
    key: null,
    synonyms: ["rename", "origin", "upstream"],
  },
  {
    id: "url",
    tab: "general",
    label: "URL",
    help: "Where fetching and pulling get commits from, and where pushing sends them unless push URLs are set.",
    key: remoteKey("url"),
    synonyms: ["address", "server", "fetch url", "https", "ssh", "location"],
  },
  {
    id: "pushurl",
    tab: "general",
    label: "Push URLs",
    help: "Where pushing goes instead of the URL. With several, every push goes to each of them, for example to keep a mirror up to date.",
    key: remoteKey("pushurl"),
    synonyms: ["push address", "mirror", "several servers", "multiple"],
  },
  {
    id: "head",
    tab: "general",
    label: "Default branch",
    help: "The branch the remote's name alone stands for (refs/remotes/<name>/HEAD), as in “compare with origin”. Cloning sets it to the server's default branch.",
    key: null,
    synonyms: ["HEAD", "main", "master", "set-head", "primary branch"],
  },
  {
    id: "followRemoteHEAD",
    tab: "general",
    label: "When the server's default branch changes",
    help: "What fetching does when the server's default branch is not the one set here.",
    key: remoteKey("followRemoteHEAD"),
    synonyms: ["follow", "default branch", "HEAD", "fetch"],
    since: [2, 48],
  },
];

/** The setting with `id`; settings are listed above, so it exists. */
export function remoteSetting(id: string): RemoteSetting {
  const setting = REMOTE_SETTINGS.find((candidate) => candidate.id === id);
  if (!setting) throw new Error(`Unknown remote setting: ${id}`);
  return setting;
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
