/** A stash's files as one list, and what "Apply chosen files" sends for the chosen ones. */
import type {
  ApplyStashFilesRequestDto,
  ChangedFileDto,
  StashDto,
  StashFilesDto,
  WorkingStatusDto,
} from "@/shared/ipc/bindings";

import { fileKey } from "../store/shown";

/** One file of a stash: a tracked file it changed, or an untracked file it saved. */
export interface StashFile {
  key: string;
  path: string;
  previousPath: string | null;
  status: WorkingStatusDto;
  oldId: string | null;
  newId: string | null;
  submodule: boolean;
  untracked: boolean;
}

function listed(file: ChangedFileDto, untracked: boolean): StashFile {
  return {
    ...file,
    key: fileKey(file.path, untracked),
    status: untracked ? "untracked" : file.status,
    untracked,
  };
}

/** The changed files, then the untracked ones. */
export function stashFileList(files: StashFilesDto): StashFile[] {
  return [
    ...files.changed.map((file) => listed(file, false)),
    ...files.untracked.map((file) => listed(file, true)),
  ];
}

/** The request applying the chosen files (both names of a rename). */
export function applyRequest(
  id: string,
  files: readonly StashFile[],
  chosen: readonly string[],
): ApplyStashFilesRequestDto {
  const request: ApplyStashFilesRequestDto = { id, tracked: [], untracked: [] };
  for (const file of files) {
    if (!chosen.includes(file.key)) continue;
    if (file.untracked) request.untracked.push(file.path);
    else
      request.tracked.push(...(file.previousPath ? [file.previousPath, file.path] : [file.path]));
  }
  return request;
}

/** `stash@{n}`. */
export function stashName(stash: StashDto): string {
  return `stash@{${stash.index}}`;
}

/** The message without git's `WIP on <branch>:` / `On <branch>:` prefix. */
export function stashDescription(stash: StashDto): string {
  const separator = stash.message.indexOf(": ");
  return stash.branch && separator !== -1 ? stash.message.slice(separator + 2) : stash.message;
}
