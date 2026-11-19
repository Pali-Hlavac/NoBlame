/**
 * Every setting the remote editor shows, in one typed list: its tab, label, help, git key and
 * the other words people search for. The tabs render from it and the search reads it, so a new
 * setting is found as soon as it is listed (`search.ts`).
 */
import { FETCH_SETTINGS, PUSH_SETTINGS } from "./registryTransfer";
import type { RemoteSetting } from "./settingTypes";

export type { GitRelease, RemoteSetting, RemoteTab } from "./settingTypes";
export { REMOTE_TABS, tabLabel } from "./settingTypes";

const remoteKey = (name: string) => (remote: string) => `remote.${remote}.${name}`;

const GENERAL_SETTINGS: readonly RemoteSetting[] = [
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

export const REMOTE_SETTINGS: readonly RemoteSetting[] = [
  ...GENERAL_SETTINGS,
  ...FETCH_SETTINGS,
  ...PUSH_SETTINGS,
];

/** The setting with `id`; settings are listed above, so it exists. */
export function remoteSetting(id: string): RemoteSetting {
  const setting = REMOTE_SETTINGS.find((candidate) => candidate.id === id);
  if (!setting) throw new Error(`Unknown remote setting: ${id}`);
  return setting;
}

export { gitRelease, supports } from "./settingTypes";
