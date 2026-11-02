/** The file a diff is shown for. */
import type { ListedFile } from "@/features/changed-files";

/** A file whose diff is shown: one a commit changed, or one in the working tree. */
export interface DiffFile extends ListedFile {
  /** Blob before the change (hex); `null` when absent. */
  oldId: string | null;
  /** Blob after the change (hex), or the working tree file's id; `null` when absent. */
  newId: string | null;
  /** The new side is the working tree file at `path`, named by `newId`. */
  worktree?: boolean;
}
