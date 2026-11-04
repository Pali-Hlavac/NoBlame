/** Which working tree files the "Stash changes" dialog offers, and the request it sends. */
import type { StashRequestDto, WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

/** Every changed file once (a file both staged and changed again is one row), sorted by path. */
export function stashableFiles(
  status: WorkingTreeStatusDto,
  includeUntracked: boolean,
): WorkingFileDto[] {
  const byPath = new Map<string, WorkingFileDto>();
  for (const file of [...status.staged, ...status.unstaged]) {
    if (file.status === "untracked" && !includeUntracked) continue;
    if (!byPath.has(file.path) || file.status !== "untracked") byPath.set(file.path, file);
  }
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Neither side of the status was cut at 5,000 files, so the dialog lists every change. */
export function listsComplete(status: WorkingTreeStatusDto): boolean {
  const { staged, unstaged, untracked, conflicted } = status.summary;
  return (
    status.staged.length >= staged && status.unstaged.length >= unstaged + untracked + conflicted
  );
}

interface StashForm {
  message: string;
  keepIndex: boolean;
  includeUntracked: boolean;
}

/**
 * The request: every change when every file is chosen and listed (no paths, so git takes
 * them all), otherwise the chosen paths (both names of a rename).
 */
export function stashRequest(
  form: StashForm,
  files: readonly WorkingFileDto[],
  excluded: readonly string[],
  everythingListed: boolean,
): StashRequestDto {
  const chosen = files.filter((file) => !excluded.includes(file.path));
  const all = everythingListed && chosen.length === files.length;
  return {
    ...form,
    paths: all
      ? null
      : chosen.flatMap((file) =>
          file.previousPath ? [file.previousPath, file.path] : [file.path],
        ),
  };
}
