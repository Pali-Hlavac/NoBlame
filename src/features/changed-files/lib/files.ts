/** Pure helpers for showing changed files. */
import type { ChangeStatusDto, ChangedFileDto } from "@/shared/ipc/bindings";

/** One-letter code and word for each status, as `git status --short` and screen readers. */
export const STATUS_LABELS: Readonly<Record<ChangeStatusDto, { letter: string; word: string }>> = {
  added: { letter: "A", word: "added" },
  deleted: { letter: "D", word: "deleted" },
  modified: { letter: "M", word: "modified" },
  renamed: { letter: "R", word: "renamed" },
  copied: { letter: "C", word: "copied" },
};

/** Splits `src/app/main.ts` into the name `main.ts` and the folder `src/app`. */
export function splitPath(path: string): { name: string; folder: string } {
  const slash = path.lastIndexOf("/");
  return slash < 0
    ? { name: path, folder: "" }
    : { name: path.slice(slash + 1), folder: path.slice(0, slash) };
}

/** Accessible description of one row, e.g. "main.ts, modified, in src/app". */
export function describeFile(file: ChangedFileDto): string {
  const { name, folder } = splitPath(file.path);
  const parts = [name, STATUS_LABELS[file.status].word];
  if (file.previousPath) parts.push(`from ${file.previousPath}`);
  if (folder) parts.push(`in ${folder}`);
  if (file.submodule) parts.push("submodule");
  return parts.join(", ");
}
