import type { ReactNode } from "react";
import { toast } from "sonner";

import { WORKING_TREE } from "@/features/selection";
import { openModuleById } from "@/features/workbench";
import type { CommitRowDto } from "@/shared/ipc/bindings";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";
import { copyToClipboard } from "@/shared/lib/clipboard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { openComparison } from "../api/compare";
import { commitMenu, type MenuEntry } from "../lib/commitMenu";
import { shortId } from "../lib/format";

function Entries({ entries }: { entries: readonly MenuEntry[] }) {
  return entries.map((entry) => {
    switch (entry.type) {
      case "separator":
        return <ContextMenuSeparator key={entry.id} />;
      case "submenu":
        return (
          <ContextMenuSub key={entry.id}>
            <ContextMenuSubTrigger>
              <span className="max-w-64 truncate">{entry.label}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <Entries entries={entry.entries} />
            </ContextMenuSubContent>
          </ContextMenuSub>
        );
      case "item": {
        const stub = entry.milestone !== undefined || !entry.run;
        return (
          <ContextMenuItem
            key={entry.id}
            disabled={stub}
            onSelect={() => {
              if (!stub) entry.run?.();
            }}
          >
            <span className="flex-1">{entry.label}</span>
            {entry.milestone && (
              <span className="text-xs text-muted-foreground">{entry.milestone}</span>
            )}
          </ContextMenuItem>
        );
      }
    }
  });
}

/** The Files module's id in the module registry (`app/workbench/modules.ts`). */
const FILES_MODULE_ID = "files";

interface CommitContextMenuProps {
  repoId: number;
  repoPath: string;
  /** The selected commit's row and text; no menu without them (working tree rows, loading). */
  row: number | undefined;
  commit: CommitRowDto | undefined;
  /** The repository has a working tree to compare with (not bare). */
  hasWorkingTree: boolean;
  /** Whether its history is highlighted; `undefined` when highlighting is switched off. */
  highlighted: boolean | undefined;
  onToggleHighlight: () => void;
  /** The commit list; right-clicking a row selects it first, so the menu is the selection's. */
  children: ReactNode;
}

/** The context menu of the selected commit (right click, Shift+F10 or the Menu key). */
export function CommitContextMenu(props: CommitContextMenuProps) {
  const { repoId, repoPath, row, commit } = props;
  const isHead = commit?.refs.some((ref) => ref.kind === "head" || ref.isHead) ?? false;
  const entries =
    commit && row !== undefined
      ? commitMenu(commit, {
          copy: copyToClipboard,
          copyMessage: () => {
            unwrap(commands.getCommitDetails(repoId, row)).then(
              (details) => {
                copyToClipboard(details.message.trimEnd(), "Message");
              },
              (error: unknown) => toast.error(toIpcError(error).message),
            );
          },
          highlighted: props.highlighted,
          toggleHighlight: props.onToggleHighlight,
          // The commit is already selected (right click selects first); the module follows it.
          browseFiles: () => {
            openModuleById(FILES_MODULE_ID);
          },
          compareWithHead: isHead
            ? undefined
            : () => {
                openComparison(repoPath, {
                  base: commit.id,
                  target: "HEAD",
                  sinceMergeBase: false,
                });
              },
          compareWithWorkingTree: !props.hasWorkingTree
            ? undefined
            : () => {
                openComparison(repoPath, {
                  base: commit.id,
                  target: WORKING_TREE,
                  sinceMergeBase: false,
                });
              },
          compareWithCurrent: (revision) => {
            openComparison(repoPath, { base: "HEAD", target: revision, sinceMergeBase: false });
          },
        })
      : null;
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={!entries}>
        {props.children}
      </ContextMenuTrigger>
      {entries && commit && (
        <ContextMenuContent aria-label={`Actions for commit ${shortId(commit.id)}`}>
          <ContextMenuLabel>
            {shortId(commit.id)} {commit.summary}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          <Entries entries={entries} />
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
