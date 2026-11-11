/** Git settings people change most, named and explained for the Git settings section. */

export interface KnownSetting {
  key: string;
  label: string;
  description: string;
  /** Typical values, offered as a hint. */
  example: string;
}

export const KNOWN_SETTINGS: readonly KnownSetting[] = [
  {
    key: "user.name",
    label: "Your name",
    description: "Written into the commits you make.",
    example: "Ada Lovelace",
  },
  {
    key: "user.email",
    label: "Your email",
    description: "Written into the commits you make.",
    example: "ada@example.com",
  },
  {
    key: "pull.rebase",
    label: "Pull by rebasing",
    description: "true replays your commits on top of what you pull, instead of merging.",
    example: "true or false",
  },
  {
    key: "fetch.prune",
    label: "Prune when fetching",
    description: "true removes remote branches that were deleted on the remote.",
    example: "true or false",
  },
  {
    key: "push.autoSetupRemote",
    label: "Push new branches upstream",
    description: "true sets the upstream of a new branch on its first push.",
    example: "true or false",
  },
  {
    key: "init.defaultBranch",
    label: "First branch of new repositories",
    description: "The name of the branch a new repository starts on.",
    example: "main",
  },
  {
    key: "core.autocrlf",
    label: "Line endings",
    description: "true turns line endings into CRLF in your files and LF in the history (Windows).",
    example: "true, input or false",
  },
  {
    key: "commit.gpgSign",
    label: "Sign commits",
    description: "true signs every commit (needs a signing key set up).",
    example: "true or false",
  },
  {
    key: "merge.ff",
    label: "Fast-forward merges",
    description: "false always makes a merge commit; only refuses merges that need one.",
    example: "true, false or only",
  },
];

/** The value of `key` in `entries` (keys compare without case for section and name). */
export function settingValue(
  entries: readonly { key: string; value: string }[],
  key: string,
): string | undefined {
  const wanted = key.toLowerCase();
  return entries.findLast((entry) => entry.key.toLowerCase() === wanted)?.value;
}

/** Whether `key` is one of the named settings. */
export function isKnown(key: string): boolean {
  return KNOWN_SETTINGS.some((setting) => setting.key.toLowerCase() === key.toLowerCase());
}

/** Why `key` cannot be a setting name, or `null` (git checks again). */
export function keyProblem(key: string): string | null {
  const trimmed = key.trim();
  if (trimmed === "") return "Type a setting name, such as user.name.";
  const parts = trimmed.split(".");
  const plain = /^[A-Za-z][A-Za-z0-9-]*$/;
  const first = parts[0] ?? "";
  const last = parts.at(-1) ?? "";
  if (parts.length < 2 || !plain.test(first) || !plain.test(last)) {
    return "Setting names look like user.name or remote.origin.url.";
  }
  return null;
}
