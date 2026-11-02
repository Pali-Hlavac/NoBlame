import { PackageIcon } from "lucide-react";

import type { WorkingStatusDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { STATUS_LABELS, splitPath, type ListedFile } from "../lib/files";

const STATUS_CLASSES: Readonly<Record<WorkingStatusDto, string>> = {
  added: "text-status-added",
  modified: "text-status-modified",
  deleted: "text-status-deleted",
  renamed: "text-status-renamed",
  copied: "text-status-renamed",
  untracked: "text-status-added",
  conflicted: "text-destructive",
};

/** One file: status letter, name, folder, and the old name of a rename. */
export function ChangedFileRow({ file, active }: { file: ListedFile; active: boolean }) {
  const { name, folder } = splitPath(file.path);
  return (
    <div
      className={cn(
        "flex h-full items-center gap-2 px-2 text-sm",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
      title={file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}
    >
      <span
        aria-hidden
        className={cn(
          "w-3 shrink-0 text-center font-mono text-xs font-semibold",
          STATUS_CLASSES[file.status],
        )}
      >
        {STATUS_LABELS[file.status].letter}
      </span>
      {file.submodule && (
        <PackageIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={cn("shrink-0 truncate", file.status === "deleted" && "line-through")}>
        {name}
      </span>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {file.previousPath ? `← ${file.previousPath}` : folder}
      </span>
    </div>
  );
}
