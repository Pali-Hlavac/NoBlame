/** Wording of a repository's uncommitted file counts. */
import type { ChangeCountsDto } from "@/shared/ipc/bindings";

/** "3 new, 2 changed and 1 deleted file(s) not committed"; empty when there are none. */
export function describeChangeCounts(counts: ChangeCountsDto): string {
  const parts = [
    counts.added > 0 && `${counts.added.toLocaleString()} new`,
    counts.changed > 0 && `${counts.changed.toLocaleString()} changed`,
    counts.deleted > 0 && `${counts.deleted.toLocaleString()} deleted`,
  ].filter((part): part is string => part !== false);
  if (parts.length === 0) return "";
  const total = counts.added + counts.changed + counts.deleted;
  const listed =
    parts.length === 1
      ? parts.join("")
      : `${parts.slice(0, -1).join(", ")} and ${parts.slice(-1).join("")}`;
  return `${listed} ${total === 1 ? "file" : "files"} not committed`;
}
