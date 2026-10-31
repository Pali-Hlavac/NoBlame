import type { ReactNode } from "react";

import { showBlame } from "@/features/blame";
import { showHistory } from "@/features/history";
import { copyToClipboard } from "@/shared/lib/clipboard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { saveFileAs } from "../api/save";
import type { TreeRow } from "../lib/rows";

interface FileTreeMenuProps {
  repoId: number;
  repoPath: string;
  /** The commit shown (full id), for Blame; undefined while it loads. */
  commit: string | undefined;
  /** The row with the cursor; no menu on notes or while nothing is chosen. */
  row: TreeRow | undefined;
  onOpen: () => void;
  /** The tree; right-clicking a row moves the cursor first, so the menu is that row's. */
  children: ReactNode;
}

/** The context menu of the tree's row with the cursor (right click, Shift+F10, Menu key). */
export function FileTreeMenu(props: FileTreeMenuProps) {
  const { repoId, repoPath, commit, row, onOpen, children } = props;
  const entry = row?.type === "entry" ? row : undefined;
  const folder = entry?.entry.kind === "folder";
  const blob = entry && !folder && entry.entry.kind !== "submodule" ? entry.entry : undefined;
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={!entry}>
        {children}
      </ContextMenuTrigger>
      {entry && (
        <ContextMenuContent aria-label={`Actions for ${entry.path}`}>
          <ContextMenuLabel className="max-w-72 truncate">{entry.path}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onOpen}>
            {folder ? (entry.expanded ? "Close" : "Open") : "Show"}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!blob}
            onSelect={() => {
              if (blob) void saveFileAs(repoId, blob.id, blob.name);
            }}
          >
            Save as…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(entry.path, "Path");
            }}
          >
            Copy path
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(entry.entry.name, "Name");
            }}
          >
            Copy name
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              showHistory(repoPath, { path: entry.path, folder });
            }}
          >
            {folder ? "Folder history" : "File history"}
          </ContextMenuItem>
          {!folder && (
            <ContextMenuItem
              disabled={!blob || commit === undefined}
              onSelect={() => {
                if (commit !== undefined) showBlame(repoPath, { commit, path: entry.path });
              }}
            >
              Blame
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
