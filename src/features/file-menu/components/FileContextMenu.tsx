import type { ReactNode } from "react";

import { showBlame } from "@/features/blame";
import { showHistory } from "@/features/history";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { fileManagerName } from "@/shared/lib/platform";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { openWorktreeFile, showWorktreeFile } from "../api/open";
import { saveFileAs } from "../api/save";
import { fileName, fullPath } from "../lib/paths";

/** A file in a list, as the menu needs it. */
export interface MenuFile {
  /** Relative to the repository, `/`-separated. */
  path: string;
  /** The listed version's blob, for **Save as…**; none for working tree files. */
  blobId?: string | null;
  /** The commit it is listed at (full id), for **Blame**. */
  commit?: string;
}

/** An action of the list itself (Show diff, Stage, Discard…), shown first. */
export interface MenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface FileContextMenuProps {
  repoId: number;
  repoPath: string;
  /** The file with the list's cursor; no menu while there is none. */
  file: MenuFile | undefined;
  actions?: readonly MenuAction[];
  /** The list; right-clicking a row moves the cursor first, so the menu is that row's. */
  children: ReactNode;
}

/**
 * The context menu of a file in any list (Changed files, Commit, Compare, Stash): the list's own
 * actions, then opening the file or showing it in the file manager, saving the listed version,
 * copying its path or name, and its history or blame. Right click, Shift+F10 or the Menu key.
 */
export function FileContextMenu({
  repoId,
  repoPath,
  file,
  actions,
  children,
}: FileContextMenuProps) {
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={!file}>
        {children}
      </ContextMenuTrigger>
      {file && (
        <ContextMenuContent aria-label={`Actions for ${file.path}`}>
          <ContextMenuLabel className="max-w-72 truncate">{file.path}</ContextMenuLabel>
          <ContextMenuSeparator />
          {actions && actions.length > 0 && (
            <>
              {actions.map((action) => (
                <ContextMenuItem
                  key={action.label}
                  disabled={action.disabled}
                  onSelect={action.onSelect}
                >
                  {action.label}
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            onSelect={() => {
              openWorktreeFile(repoId, file.path);
            }}
          >
            Open working tree file
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              showWorktreeFile(repoId, file.path);
            }}
          >
            Show in {fileManagerName()}
          </ContextMenuItem>
          {file.blobId && (
            <ContextMenuItem
              onSelect={() => {
                if (file.blobId) void saveFileAs(repoId, file.blobId, fileName(file.path));
              }}
            >
              Save this version as…
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(file.path, "Path");
            }}
          >
            Copy path
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(fullPath(repoPath, file.path), "Full path");
            }}
          >
            Copy full path
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(fileName(file.path), "Name");
            }}
          >
            Copy name
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              showHistory(repoPath, { path: file.path, folder: false });
            }}
          >
            File history
          </ContextMenuItem>
          {file.commit !== undefined && (
            <ContextMenuItem
              onSelect={() => {
                if (file.commit !== undefined) {
                  showBlame(repoPath, { commit: file.commit, path: file.path });
                }
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
