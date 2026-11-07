/** Checking a remote's name and URL before git does, and naming lists in sentences. */

/** Branch names listed in a sentence before the rest are counted. */
const MAX_NAMED = 5;

/** Why `name` cannot be a remote's (new) name, or null; git checks the rest. */
export function remoteNameProblem(name: string, taken: readonly string[]): string | null {
  if (name === "") return "Enter a name, such as origin or upstream.";
  if (/\s/.test(name)) return "A remote's name cannot contain spaces.";
  if (name.startsWith("-")) return "A remote's name cannot start with “-”.";
  if (/\.\.|[~^:?*[\\]|@\{/.test(name)) {
    return "A remote's name cannot contain “..”, “~”, “^”, “:”, “?”, “*”, “[”, “\\” or “@{”.";
  }
  if (taken.includes(name)) return `There is already a remote named ${name}.`;
  return null;
}

/** Why `url` cannot be a remote's address, or null. */
export function urlProblem(url: string): string | null {
  if (url.trim() === "") return "Enter the address, such as https://host/owner/repo.git.";
  if (url.trim().startsWith("-")) return "An address cannot start with “-”.";
  return null;
}

/** `a, b and c`, or `a, b, c, d, e and 3 more`. */
export function namedList(names: readonly string[]): string {
  const shown = names.slice(0, MAX_NAMED);
  const more = names.length - shown.length;
  const parts = more > 0 ? [...shown, `${String(more)} more`] : shown;
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] ?? ""}`;
}

/** `1 remote branch`, `3 remote branches`. */
export function branchCount(count: number): string {
  return `${count.toLocaleString()} remote ${count === 1 ? "branch" : "branches"}`;
}
