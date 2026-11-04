/** Ready-made `.gitignore` patterns for an untracked file or folder. */

/** One way to ignore the file: what it says and the pattern written. */
export interface IgnoreChoice {
  id: "path" | "name" | "extension" | "folder";
  label: string;
  pattern: string;
}

/** `text` with the characters patterns treat as wildcards escaped, and a last space kept. */
export function escapePattern(text: string): string {
  const escaped = text.replace(/[\\*?[]/g, (char) => `\\${char}`);
  return escaped.endsWith(" ") ? `${escaped.slice(0, -1)}\\ ` : escaped;
}

/** A pattern that does not start with `/`: a leading `#` or `!` would be a comment or a negation. */
function unanchored(pattern: string): string {
  return /^[#!]/.test(pattern) ? `\\${pattern}` : pattern;
}

/**
 * The patterns offered for `path` as the status lists it (an untracked folder ends in `/`):
 * the exact path, every file or folder with that name, every file with that extension, and the
 * folder it is in.
 */
export function ignoreChoices(path: string): IgnoreChoice[] {
  const folder = path.endsWith("/");
  const trimmed = folder ? path.slice(0, -1) : path;
  const slash = trimmed.lastIndexOf("/");
  const name = trimmed.slice(slash + 1);
  const parent = slash < 0 ? "" : trimmed.slice(0, slash);
  const suffix = folder ? "/" : "";
  const choices: IgnoreChoice[] = [
    {
      id: "path",
      label: folder ? "Only this folder" : "Only this file",
      pattern: `/${escapePattern(trimmed)}${suffix}`,
    },
    {
      id: "name",
      label: `Every ${folder ? "folder" : "file"} named ${name}`,
      pattern: `${unanchored(escapePattern(name))}${suffix}`,
    },
  ];
  // `.env` has no extension; `notes.txt` and `archive.tar.gz` do (the last one).
  const dot = name.lastIndexOf(".");
  if (!folder && dot > 0 && dot < name.length - 1) {
    const extension = name.slice(dot);
    choices.push({
      id: "extension",
      label: `Every ${extension} file`,
      pattern: `*${escapePattern(extension)}`,
    });
  }
  if (parent !== "") {
    choices.push({
      id: "folder",
      label: `The folder ${parent}/`,
      pattern: `/${escapePattern(parent)}/`,
    });
  }
  return choices;
}
