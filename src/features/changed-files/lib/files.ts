/** Pure helpers for showing changed files. */
import type { WorkingStatusDto } from "@/shared/ipc/bindings";

/**
 * A file in a list: one a commit changed, or one in the working tree (which can also be
 * untracked or conflicted).
 */
export interface ListedFile {
  path: string;
  previousPath: string | null;
  status: WorkingStatusDto;
  submodule: boolean;
}

/** One-letter code and word for each status, as `git status --short` and screen readers. */
export const STATUS_LABELS: Readonly<Record<WorkingStatusDto, { letter: string; word: string }>> = {
  added: { letter: "A", word: "added" },
  deleted: { letter: "D", word: "deleted" },
  modified: { letter: "M", word: "modified" },
  renamed: { letter: "R", word: "renamed" },
  copied: { letter: "C", word: "copied" },
  untracked: { letter: "?", word: "untracked" },
  conflicted: { letter: "U", word: "conflicted" },
};

/** Splits `src/app/main.ts` into the name `main.ts` and the folder `src/app`. */
export function splitPath(path: string): { name: string; folder: string } {
  const slash = path.lastIndexOf("/");
  return slash < 0
    ? { name: path, folder: "" }
    : { name: path.slice(slash + 1), folder: path.slice(0, slash) };
}

/** Compares names as people read them: case aside, numbers by value (`file2` before `file10`). */
const NAME_ORDER = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Orders two paths folder by folder, so a folder's files stay together (`src/a/x` before
 * `src/a-b/x`, which byte order would swap); paths equal but for case keep git's order.
 */
export function comparePaths(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index++) {
    const order = NAME_ORDER.compare(left[index] ?? "", right[index] ?? "");
    if (order !== 0) return order;
  }
  if (left.length !== right.length) return left.length - right.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `files` sorted by their whole path (see {@link comparePaths}). */
export function sortedByPath<T extends { path: string }>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => comparePaths(a.path, b.path));
}

/** Accessible description of one row, e.g. "main.ts, modified, in src/app". */
export function describeFile(file: ListedFile): string {
  const { name, folder } = splitPath(file.path);
  const parts = [name, STATUS_LABELS[file.status].word];
  if (file.previousPath) parts.push(`from ${file.previousPath}`);
  if (folder) parts.push(`in ${folder}`);
  if (file.submodule) parts.push("submodule");
  return parts.join(", ");
}

/** "1 file changed", "1,200 files staged". */
export function fileCount(count: number, verb: string): string {
  return `${count.toLocaleString()} ${count === 1 ? "file" : "files"} ${verb}`;
}
