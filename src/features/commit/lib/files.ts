/**
 * Which paths files stand for in the index, what to ask before staging conflicted ones, and what
 * to show after files leave a list.
 */
import type { WorkingFileDto } from "@/shared/ipc/bindings";

/** The paths git must be given for `files`: a rename is undone by restoring both names. */
export function indexPaths(files: readonly WorkingFileDto[]): string[] {
  return files.flatMap((file) =>
    file.previousPath ? [file.path, file.previousPath] : [file.path],
  );
}

/** The question before staging `files` when some have conflicts (staging resolves them). */
export function resolveQuestion(files: readonly WorkingFileDto[]): string | null {
  const conflicted = files.filter((file) => file.status === "conflicted");
  const [only] = files;
  if (conflicted.length === 0 || !only) return null;
  if (files.length === 1) return `Mark ${only.path} as resolved?`;
  const count = conflicted.length;
  return `Stage ${files.length.toLocaleString()} files, marking ${count.toLocaleString()} conflicted ${count === 1 ? "file" : "files"} as resolved?`;
}

/**
 * The file to show once `moved` have left the list and `files[index]` was shown: the first one
 * after it that stays, else the nearest before it.
 */
export function neighbour(
  files: readonly WorkingFileDto[],
  index: number,
  moved: ReadonlySet<string>,
): WorkingFileDto | undefined {
  const stays = (file: WorkingFileDto | undefined) => file !== undefined && !moved.has(file.path);
  return files.slice(index + 1).find(stays) ?? files.slice(0, index).reverse().find(stays);
}
