import type { ReactNode } from "react";

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

/** Blame arrives with the rest of slice 8 of M3 (docs/roadmap.md). */
const BLAME_MILESTONE = "M3";

function Planned({ label }: { label: string }) {
  return (
    <ContextMenuItem disabled>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{BLAME_MILESTONE}</span>
    </ContextMenuItem>
  );
}

interface FileTreeMenuProps {
  repoId: number;
  repoPath: string;
  /** The row with the cursor; no menu on notes or while nothing is chosen. */
  row: TreeRow | undefined;
  onOpen: () => void;
  /** The tree; right-clicking a row moves the cursor first, so the menu is that row's. */
  children: ReactNode;
}

/** The context menu of the tree's row with the cursor (right click, Shift+F10, Menu key). */
export function FileTreeMenu({ repoId, repoPath, row, onOpen, children }: FileTreeMenuProps) {
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
          {!folder && <Planned label="Blame" />}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
