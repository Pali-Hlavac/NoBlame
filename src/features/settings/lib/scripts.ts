/** Checking a user script before it is added (the backend checks it again when it runs). */

/** The placeholders scripts may use (`git_core::script::PLACEHOLDERS`). */
export const SCRIPT_PLACEHOLDERS = ["{sha}", "{short}", "{subject}", "{branch}", "{repo}"];

/** `command` without a leading `git` (scripts store git's arguments). */
export function withoutGit(command: string): string {
  return command.trim().replace(/^git(\s+|$)/, "");
}

/** Why the script cannot be added, or `null`. */
export function scriptProblem(
  name: string,
  command: string,
  scripts: readonly { name: string }[],
): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Give the script a name.";
  if (scripts.some((script) => script.name === trimmed)) return "A script has this name already.";
  const line = withoutGit(command);
  if (line === "") return "Write git's arguments, such as log --stat -1 {sha}.";
  const quotes = (line.match(/"/g) ?? []).length;
  const singles = (line.match(/'/g) ?? []).length;
  if (quotes % 2 === 1 || singles % 2 === 1) return "A quote is not closed.";
  const unknown = (line.match(/\{[A-Za-z]+\}/g) ?? []).find(
    (found) => !SCRIPT_PLACEHOLDERS.includes(found),
  );
  if (unknown) return `${unknown} is not a placeholder. Use ${SCRIPT_PLACEHOLDERS.join(", ")}.`;
  return null;
}
