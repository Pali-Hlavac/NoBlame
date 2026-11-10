/** Folder paths as typed or picked (Windows or POSIX), for dialogs that build new folders. */

/** `parent` and `name` joined with the separator `parent` uses (`\` on Windows paths). */
export function joinPath(parent: string, name: string): string {
  const separator = parent.includes("\\") || /^[A-Za-z]:$/.test(parent) ? "\\" : "/";
  return `${parent.replace(/[/\\]+$/, "")}${separator}${name}`;
}

/** The folder that holds `path` (`C:\code` for `C:\code\app`, `C:\` for `C:\app`). */
export function parentOf(path: string): string {
  const parent = path.replace(/[/\\]+$/, "").replace(/[/\\][^/\\]*$/, "");
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent === "" && path.startsWith("/") ? "/" : parent;
}
