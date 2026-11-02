/** The files behind each working tree row. */
import type { StatusSummaryDto, WorkingFileDto, WorkingTreeStatusDto } from "@/shared/ipc/bindings";

import type { WorkingTreeKind } from "./rows";

/** The listed files of a row: changed, untracked and conflicted ones, or the staged ones. */
export function filesOf(status: WorkingTreeStatusDto, kind: WorkingTreeKind): WorkingFileDto[] {
  return kind === "index" ? status.staged : status.unstaged;
}

/** How many files a row has in all; the lists stop at 5,000. */
export function totalOf(summary: StatusSummaryDto, kind: WorkingTreeKind): number {
  return kind === "index"
    ? summary.staged
    : summary.unstaged + summary.untracked + summary.conflicted;
}
