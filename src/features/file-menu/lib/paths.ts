/** Paths for the file menu's Copy items. */

/** The last part of `src/app/main.ts`: `main.ts`. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * The file's path on disk: the repository's folder and the file's path (`/`-separated, relative)
 * joined with the separator the folder uses (`C:\code\app` + `src/a.ts` → `C:\code\app\src\a.ts`).
 */
export function fullPath(repoPath: string, path: string): string {
  const separator = repoPath.includes("\\") ? "\\" : "/";
  const root = repoPath.replace(/[\\/]+$/, "");
  return `${root}${separator}${path.split("/").join(separator)}`;
}
