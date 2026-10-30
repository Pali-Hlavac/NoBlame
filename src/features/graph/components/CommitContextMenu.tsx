import type { ReactNode } from "react";
import { toast } from "sonner";

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

interface CommitContextMenuProps {
  repoId: number;
  /** The selected commit's row and text; no menu without them (working tree rows, loading). */
  row: number | undefined;
  commit: CommitRowDto | undefined;
  /** Whether its history is highlighted; `undefined` when highlighting is switched off. */
  highlighted: boolean | undefined;
  onToggleHighlight: () => void;
  /** The commit list; right-clicking a row selects it first, so the menu is the selection's. */
  children: ReactNode;
}

/** The context menu of the selected commit (right click, Shift+F10 or the Menu key). */
export function CommitContextMenu(props: CommitContextMenuProps) {
  const { repoId, row, commit } = props;
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
