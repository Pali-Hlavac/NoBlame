/** Which paths a file stands for in the index, and what to show after it leaves a list. */
import type { WorkingFileDto } from "@/shared/ipc/bindings";

/** The paths git must be given for `file`: a rename is undone by restoring both names. */
export function indexPaths(file: WorkingFileDto): string[] {
  return file.previousPath ? [file.path, file.previousPath] : [file.path];
}

/** The file to show once `files[index]` has moved to the other list: the next, else the one before. */
export function neighbour(
  files: readonly WorkingFileDto[],
  index: number,
): WorkingFileDto | undefined {
  return files[index + 1] ?? files[index - 1];
}
