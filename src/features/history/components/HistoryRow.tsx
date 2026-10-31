import { GitMergeIcon } from "lucide-react";

import { formatCommitDate, shortId } from "@/features/graph";
import type { FileHistoryRowDto, PathChangeDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { CHANGE_LABELS } from "../lib/rows";

const CHANGE_CLASSES: Readonly<Record<PathChangeDto, string>> = {
  added: "text-status-added",
  modified: "text-status-modified",
  deleted: "text-status-deleted",
  renamed: "text-status-renamed",
  merge: "text-muted-foreground",
};

interface HistoryRowProps {
  entry: FileHistoryRowDto | undefined;
  /** The path the history is of; a row whose file had another name shows that name. */
  path: string;
  active: boolean;
}

/** One commit: what it did to the file, id, summary, the file's old name, author and date. */
export function HistoryRow({ entry, path, active }: HistoryRowProps) {
  const base = cn(
    "flex h-full items-center gap-2 px-2 text-sm",
    active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
  );
  if (!entry) return <div className={base} aria-hidden />;
  const otherName = entry.previousPath
    ? `← ${entry.previousPath}`
    : entry.path !== path
      ? `as ${entry.path}`
      : "";
  return (
    <div
      className={cn(base, entry.row === null && "opacity-50")}
      title={entry.row === null ? "Hidden by the graph's filter" : undefined}
    >
      <span
        aria-hidden
        className={cn(
          "flex w-3 shrink-0 justify-center font-mono text-xs font-semibold",
          CHANGE_CLASSES[entry.change],
        )}
      >
        {entry.change === "merge" ? (
          <GitMergeIcon className="size-3.5" />
        ) : (
          CHANGE_LABELS[entry.change].letter
        )}
      </span>
      <span className="w-[4.5rem] shrink-0 font-mono text-xs text-muted-foreground">
        {shortId(entry.id)}
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.summary}</span>
      {otherName && (
        <span className="max-w-[30%] shrink truncate text-xs text-muted-foreground">
          {otherName}
        </span>
      )}
      <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
        {entry.authorName}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatCommitDate(entry.authorTime)}
      </span>
    </div>
  );
}
