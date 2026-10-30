import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileIcon,
  FileSymlinkIcon,
  FolderIcon,
  FolderOpenIcon,
  PackageIcon,
  type LucideIcon,
} from "lucide-react";

import type { TreeEntryKindDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";

import type { TreeRow } from "../lib/rows";

/** Indentation per folder level, in CSS pixels. */
const INDENT_PX = 14;
/** Left padding of top-level rows, in CSS pixels. */
const ROW_PADDING_PX = 6;

const ICONS: Readonly<Record<Exclude<TreeEntryKindDto, "folder">, LucideIcon>> = {
  file: FileIcon,
  executable: FileCodeIcon,
  symlink: FileSymlinkIcon,
  submodule: PackageIcon,
};

/** One row of the tree: chevron and icon for folders, an icon by kind for the rest. */
export function FileTreeRow({ row, active }: { row: TreeRow; active: boolean }) {
  const indent = { paddingLeft: ROW_PADDING_PX + row.depth * INDENT_PX };
  if (row.type === "note") {
    return (
      <div className="flex h-full items-center pr-2 text-xs text-muted-foreground" style={indent}>
        {row.error === undefined ? (
          <span className="truncate pl-5 italic">{row.text}</span>
        ) : (
          <span
            className="truncate pl-5 text-destructive"
            title={toIpcError(row.error).hint ?? undefined}
          >
            {row.text}: {toIpcError(row.error).message}
          </span>
        )}
      </div>
    );
  }
  const { entry } = row;
  const folder = entry.kind === "folder";
  const Chevron = row.expanded ? ChevronDownIcon : ChevronRightIcon;
  const openIcon = row.expanded ? FolderOpenIcon : FolderIcon;
  const Icon = entry.kind === "folder" ? openIcon : ICONS[entry.kind];
  return (
    <div
      className={cn(
        "flex h-full items-center gap-1 pr-2 text-sm",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
      style={indent}
      title={row.path}
    >
      {folder ? (
        <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Icon
        className={cn("size-4 shrink-0", folder ? "text-primary" : "text-muted-foreground")}
        aria-hidden
      />
      <span className="truncate">{entry.name}</span>
    </div>
  );
}
