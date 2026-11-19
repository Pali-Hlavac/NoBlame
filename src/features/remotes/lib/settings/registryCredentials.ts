/**
 * The remote editor's Credentials and LFS settings (see `registry.ts`). Credential settings are
 * keyed by the remote's server (`credential.<server>.<name>`, the form Git Credential Manager
 * documents and reads too); the Azure DevOps account by organization
 * (`credential.azrepos:org/<org>.username`, what `git credential-manager azure-repos bind
 * --local` writes). LFS settings key by the LFS server's address.
 */
import { both, hasLfsServer, onAzure, onWindows, overHttp, withManager } from "./conditions";
import type { RemoteSetting } from "./settingTypes";

const remoteKey = (name: string) => (remote: string) => `remote.${remote}.${name}`;
const serverKey = (name: string) => () => `credential.<server>.${name}`;

export const CREDENTIAL_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "credentialHelpers",
    tab: "credentials",
    applies: overHttp,
    label: "Helpers git asks",
    help: "Programs that keep your sign-in, so git does not ask for a password every time. They are asked in this order.",
    key: null,
    synonyms: [
      "credential helper",
      "credential manager",
      "gcm",
      "wincred",
      "keychain",
      "libsecret",
      "store",
      "cache",
      "password",
    ],
  },
  {
    id: "credentialHelper",
    tab: "credentials",
    applies: overHttp,
    label: "Helpers for this server",
    help: "Asked after the helpers set elsewhere. An empty first value drops those, so only the ones listed here answer.",
    key: serverKey("helper"),
    synonyms: ["credential helper", "manager", "store", "cache", "reset"],
  },
  {
    id: "credentialActions",
    tab: "credentials",
    applies: overHttp,
    label: "Sign-in",
    help: "Sign in tests the connection: when nothing is saved, the helper asks and keeps what you enter. Forget makes the helpers drop what they keep for this remote's addresses, for example to switch accounts.",
    key: null,
    synonyms: ["sign in", "log in", "forget", "log out", "sign out", "switch account", "reject"],
  },
  {
    id: "credentialUsername",
    tab: "credentials",
    applies: overHttp,
    label: "User name",
    help: "The account git signs in with on this server, when the URL does not name one.",
    key: serverKey("username"),
    synonyms: ["user", "account", "login", "email"],
  },
  {
    id: "useHttpPath",
    tab: "credentials",
    applies: overHttp,
    label: "A separate sign-in per repository",
    help: "Keeps a sign-in for each repository path on this server instead of one for the whole server, when different repositories need different accounts.",
    key: serverKey("useHttpPath"),
    synonyms: ["path", "per repository", "several accounts", "useHttpPath"],
  },
  {
    id: "credentialProvider",
    tab: "credentials",
    applies: withManager,
    label: "Kind of server",
    help: "Tells Git Credential Manager how to sign in to this server, when it cannot tell from the address (your company's own GitHub or GitLab).",
    key: serverKey("provider"),
    synonyms: ["provider", "github enterprise", "gitlab", "bitbucket", "azure", "gcm"],
  },
  {
    id: "azureAccount",
    tab: "credentials",
    applies: onAzure,
    label: "Account for this organization",
    help: "The account Git Credential Manager uses for this Azure DevOps organization in this repository (as azure-repos bind --local). Not set: the one it remembers.",
    key: () => "credential.azrepos:org/<organization>.username",
    synonyms: ["azure devops", "account", "bind", "organization", "microsoft", "entra"],
  },
  {
    id: "azureCredentialType",
    tab: "credentials",
    applies: onAzure,
    label: "Sign in to Azure DevOps with",
    help: "A Microsoft account (OAuth, the default) or a personal access token Git Credential Manager creates and keeps.",
    key: serverKey("azreposCredentialType"),
    synonyms: ["azure devops", "oauth", "pat", "personal access token", "token"],
  },
  {
    id: "msauthUseBroker",
    tab: "credentials",
    applies: both(onAzure, onWindows),
    label: "Sign in through Windows",
    help: "Lets Windows sign you in with the account you use on this computer (the Windows broker).",
    key: serverKey("msauthUseBroker"),
    synonyms: ["azure devops", "broker", "wam", "windows account", "single sign-on", "sso"],
  },
  {
    id: "msauthFlow",
    tab: "credentials",
    applies: onAzure,
    label: "Where the Microsoft sign-in shows",
    help: "How Git Credential Manager asks for a Microsoft account when it needs one.",
    key: serverKey("msauthFlow"),
    synonyms: ["azure devops", "browser", "device code", "embedded", "flow"],
  },
];

export const LFS_SETTINGS: readonly RemoteSetting[] = [
  {
    id: "lfsurl",
    tab: "lfs",
    label: "LFS server",
    help: "Where the contents of LFS files are downloaded from and uploaded to for this remote. Not set: git-lfs works it out from the remote's URL.",
    key: remoteKey("lfsurl"),
    synonyms: ["lfs url", "large files", "endpoint", "server", "storage"],
  },
  {
    id: "lfspushurl",
    tab: "lfs",
    label: "LFS server for pushing",
    help: "Where pushing uploads LFS contents instead, when that is another server.",
    key: remoteKey("lfspushurl"),
    synonyms: ["lfs push url", "large files", "upload", "endpoint"],
  },
  {
    id: "locksverify",
    tab: "lfs",
    applies: hasLfsServer,
    label: "Check locks before pushing",
    help: "Before pushing, git-lfs asks the server whether any file you push is locked by someone else.",
    key: () => "lfs.<lfs server>.locksverify",
    synonyms: ["lock", "locked files", "verify", "locksverify"],
  },
];
