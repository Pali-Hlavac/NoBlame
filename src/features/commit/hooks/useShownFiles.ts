import { useMemo } from "react";

import { sortedByPath } from "@/features/changed-files";
import { useAppSettings } from "@/features/settings";
import { filesOf, type WorkingTreeKind } from "@/features/working-tree";
import type { WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

/** Each Commit list as it is shown, and whether rows put the folder first. */
export interface ShownFiles {
  lists: Record<WorkingTreeKind, readonly WorkingFileDto[]>;
  pathFirst: boolean;
}

/**
 * The Changes and Staged files of `status` as Settings → Commit shows them: in git's order with
 * the name first, or sorted by the whole path with the folder first.
 */
export function useShownFiles(status: WorkingTreeStatusDto | null): ShownFiles {
  const pathFirst = useAppSettings().commit.fileDisplay === "pathFirst";
  const lists = useMemo(() => {
    const list = (kind: WorkingTreeKind) => {
      const files = status ? filesOf(status, kind) : [];
      return pathFirst ? sortedByPath(files) : files;
    };
    return { worktree: list("worktree"), index: list("index") };
  }, [status, pathFirst]);
  return { lists, pathFirst };
}
