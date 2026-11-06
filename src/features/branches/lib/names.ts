/**
 * Checks a new branch or tag name as the user types, with git's reference name rules
 * (`git check-ref-format`). The backend checks again before git runs, and git has the last word.
 */

/** Characters git never allows in a reference name. */
const FORBIDDEN = ["~", "^", ":", "?", "*", "[", "\\"] as const;

/** Codes below this are control characters (and 127, DEL). */
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

function hasControl(name: string): boolean {
  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code < FIRST_PRINTABLE || code === DELETE) return true;
  }
  return false;
}

/** Why `name` cannot be a branch or tag name, or `null` when it can. */
export function refNameProblem(name: string): string | null {
  if (name === "") return "Enter a name.";
  if (name.startsWith("-")) return "A name cannot start with “-”.";
  if (name === "HEAD" || name === "@") return `“${name}” is reserved.`;
  if (/\s/.test(name)) return "A name cannot contain spaces.";
  if (hasControl(name)) return "A name cannot contain control characters.";
  const forbidden = FORBIDDEN.find((char) => name.includes(char));
  if (forbidden) return `A name cannot contain “${forbidden}”.`;
  if (name.includes("..")) return "A name cannot contain “..”.";
  if (name.includes("@{")) return "A name cannot contain “@{”.";
  if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) {
    return "Slashes separate parts of a name: none at the start or end, never two together.";
  }
  if (name.endsWith(".")) return "A name cannot end with “.”.";
  for (const part of name.split("/")) {
    if (part.startsWith(".")) return "No part of a name can start with “.”.";
    if (part.endsWith(".lock")) return "No part of a name can end with “.lock”.";
  }
  return null;
}

/** The problem with `name` as a new name next to `existing` ones, or `null`. */
export function newNameProblem(
  name: string,
  existing: ReadonlySet<string>,
  what: "branch" | "tag",
): string | null {
  const problem = refNameProblem(name);
  if (problem) return problem;
  if (existing.has(name)) return `A ${what} named “${name}” exists already.`;
  // Git stores `a` and `a/b` as a file and a folder, so one name cannot be the other's folder.
  const parts = name.split("/");
  for (let end = 1; end < parts.length; end++) {
    const folder = parts.slice(0, end).join("/");
    if (existing.has(folder)) {
      return `A ${what} named “${folder}” exists, so “${name}” cannot (Git keeps names like folders).`;
    }
  }
  const inside = [...existing].find((other) => other.startsWith(`${name}/`));
  if (inside) return `“${inside}” exists, so “${name}” cannot (Git keeps names like folders).`;
  return null;
}

/** The branch part of a remote branch's name: `feature/x` for `origin/feature/x`. */
export function branchOfRemote(name: string): string {
  const slash = name.indexOf("/");
  return slash === -1 ? name : name.slice(slash + 1);
}
