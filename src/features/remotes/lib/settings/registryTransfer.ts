/** The remote editor's Fetch and Push settings (see `registry.ts`). */
import type { RemoteSetting } from "./settingTypes";

const remoteKey = (name: string) => (remote: string) => `remote.${remote}.${name}`;
const repositoryKey = (key: string) => () => key;

export const FETCH_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "fetch",
    tab: "fetch",
    label: "What to fetch",
    help: "Which of the server's branches fetching brings here as remote branches. Fewer branches make fetching faster in big repositories.",
    key: remoteKey("fetch"),
    synonyms: ["refspec", "branches", "only", "selected", "pattern"],
  },
  {
    id: "tagOpt",
    tab: "fetch",
    label: "Tags",
    help: "Which tags fetching brings along.",
    key: remoteKey("tagOpt"),
    synonyms: ["tags", "no-tags", "versions", "releases"],
  },
  {
    id: "prune",
    tab: "fetch",
    label: "Remove remote branches deleted on the server",
    help: "Fetching deletes the remote branches here that are gone from the server. Your own branches stay.",
    key: remoteKey("prune"),
    synonyms: ["prune", "clean up", "stale", "deleted branches"],
  },
  {
    id: "pruneTags",
    tab: "fetch",
    label: "Remove tags that are not on the server",
    help: "Fetching with removal also deletes local tags the server does not have, including tags you made and did not push.",
    key: remoteKey("pruneTags"),
    synonyms: ["prune tags", "delete tags", "clean up"],
  },
  {
    id: "skipFetchAll",
    tab: "fetch",
    label: "Leave out of Fetch all",
    help: "Fetch all remotes and Fetch all in groups skip this remote; fetching it by name still works.",
    key: remoteKey("skipFetchAll"),
    synonyms: ["skip", "exclude", "fetch all", "skipDefaultUpdate", "remote update"],
  },
  {
    id: "partialClone",
    tab: "fetch",
    label: "Partial clone",
    help: "Whether this repository downloads missing contents from this remote when needed.",
    key: remoteKey("partialclonefilter"),
    synonyms: ["promisor", "filter", "blob:none", "blobless", "treeless", "partial"],
  },
];

export const PUSH_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "pushDefault",
    tab: "push",
    label: "Push here by default",
    help: "Pushing a branch goes to this remote unless the branch names another (its push remote). Pulling still uses each branch's upstream.",
    key: repositoryKey("remote.pushDefault"),
    synonyms: ["default remote", "push remote", "pushDefault", "fork"],
    repositoryWide: true,
  },
  {
    id: "pushRefspecs",
    tab: "push",
    label: "What a plain push sends",
    help: "Branches a push without names sends, and where to. Without any, git follows push.default (the current branch to its upstream).",
    key: remoteKey("push"),
    synonyms: ["refspec", "push mapping", "push.default"],
  },
  {
    id: "mirror",
    tab: "push",
    label: "Mirror this repository",
    help: "Every push makes the remote exactly like this repository: all branches and tags, deleting there what was deleted here and overwriting what differs.",
    key: remoteKey("mirror"),
    synonyms: ["mirror", "backup", "force", "all refs"],
  },
  {
    id: "followTags",
    tab: "push",
    label: "Also push annotated tags on pushed commits",
    help: "Pushing a branch also sends the annotated tags that point at commits being pushed.",
    key: repositoryKey("push.followTags"),
    synonyms: ["tags", "follow tags", "release"],
    repositoryWide: true,
  },
  {
    id: "autoSetupRemote",
    tab: "push",
    label: "Set the upstream on the first push",
    help: "Pushing a new branch without an upstream creates it on the remote with the same name and makes it the upstream.",
    key: repositoryKey("push.autoSetupRemote"),
    synonyms: ["upstream", "new branch", "set-upstream", "autoSetupRemote"],
    repositoryWide: true,
  },
  {
    id: "recurseSubmodules",
    tab: "push",
    label: "Submodules when pushing",
    help: "What pushing does about submodule commits the remote may not have yet.",
    key: repositoryKey("push.recurseSubmodules"),
    synonyms: ["submodules", "recurse", "on-demand"],
    repositoryWide: true,
  },
  {
    id: "pushGpgSign",
    tab: "push",
    label: "Sign pushes",
    help: "Signs the push itself with your key (a push certificate), for servers that check them. Not the same as signing commits.",
    key: repositoryKey("push.gpgSign"),
    synonyms: ["gpg", "sign", "certificate", "signed push"],
    repositoryWide: true,
  },
];
