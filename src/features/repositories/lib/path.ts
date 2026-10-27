/** Path helpers for repository tabs. Paths are only displayed and passed back to Rust. */
import type { RepositoryTab } from "@/features/workspace";

const SEPARATORS = /[\\/]+/;
const TRAILING_SEPARATORS = /[\\/]+$/;

/** Last path component (`C:\src\app\` → `app`); the path itself for roots like `/`. */
export function repositoryName(path: string): string {
  const trimmed = path.replace(TRAILING_SEPARATORS, "");
  const name = trimmed.split(SEPARATORS).at(-1);
  return name && name.length > 0 ? name : path;
}

/** The tab for `path`; reopening the same path focuses the existing tab. */
export function repositoryTab(path: string): RepositoryTab {
  return {
    id: `repository:${path.replace(TRAILING_SEPARATORS, "")}`,
    kind: "repository",
    title: repositoryName(path),
    path,
  };
}
