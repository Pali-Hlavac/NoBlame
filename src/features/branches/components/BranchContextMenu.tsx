import type { ReactNode } from "react";

import type { RefEntry } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { useRefActions } from "../hooks/useRefActions";
import { useUpstreamActions } from "../hooks/useUpstreamActions";
import { branchMenu } from "../lib/menu";

interface BranchContextMenuProps {
  repoId: number;
  /** The active row's reference; no menu on section headers. */
  entry: RefEntry | undefined;
  /** The entry's upstream (full name) when it is a local branch with one. */
  upstream: string | null;
  /** The list; right-clicking a row makes it active first, so the menu is that row's. */
  children: ReactNode;
}

/** The context menu of the Branches module's active row (right click, Shift+F10, Menu key). */
export function BranchContextMenu({ repoId, entry, upstream, children }: BranchContextMenuProps) {
  const actions = useRefActions(repoId);
  const upstreamActions = useUpstreamActions(repoId);
  const entries = entry
    ? branchMenu(
        entry,
        actions,
        (name) => {
          copyToClipboard(name, "Name");
        },
        entry.label.kind === "branch" ? upstreamActions(entry.label.name, upstream) : undefined,
      )
    : [];
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={entries.length === 0}>
        {children}
      </ContextMenuTrigger>
      {entry && entries.length > 0 && (
        <ContextMenuContent aria-label={`Actions for ${entry.label.name}`}>
          <ContextMenuLabel className="max-w-72 truncate">{entry.label.name}</ContextMenuLabel>
          <ContextMenuSeparator />
          {entries.map((item) =>
            item.type === "separator" ? (
              <ContextMenuSeparator key={item.id} />
            ) : (
              <ContextMenuItem key={item.id} onSelect={item.run}>
                {item.label}
              </ContextMenuItem>
            ),
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
