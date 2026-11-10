import { type ReactNode, useContext } from "react";

import { RefActionsContext } from "@/features/graph";
import type { ReflogEntryDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { entryName, isDeletion, startPoint } from "../lib/reflog";

interface ReflogMenuProps {
  repoId: number;
  /** Whose reflog is shown (`HEAD` or `refs/heads/<name>`). */
  reference: string;
  /** Whether that is HEAD or the current branch: then "restore" moves what it names. */
  current: boolean;
  /** The active row's entry. */
  entry: ReflogEntryDto | undefined;
  /** The list; right-clicking a row makes it active first, so the menu is that row's. */
  children: ReactNode;
}

/**
 * The context menu of the Reflog module's active row: restore this state (reset the current
 * branch to the entry's commit, through the reset dialog that names what is lost), create a
 * branch there (to get back lost commits without moving anything), check it out, copy its id.
 */
export function ReflogMenu({ repoId, reference, current, entry, children }: ReflogMenuProps) {
  const useRefActions = useContext(RefActionsContext);
  const actions = useRefActions(repoId);
  const usable = entry !== undefined && !isDeletion(entry);
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild disabled={!usable}>
        {children}
      </ContextMenuTrigger>
      {usable ? (
        <ContextMenuContent aria-label={`Actions for ${entryName(reference, entry)}`}>
          <ContextMenuLabel className="max-w-72 truncate">
            {entryName(reference, entry)}: {entry.message}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {actions ? (
            <>
              <ContextMenuItem
                onSelect={() => {
                  actions.reset(startPoint(reference, entry), { restore: true });
                }}
              >
                {current ? "Restore this state…" : "Reset the current branch to here…"}
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  actions.createBranch(startPoint(reference, entry));
                }}
              >
                Create a branch here…
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  actions.checkoutCommit(startPoint(reference, entry));
                }}
              >
                Check out this commit…
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          ) : null}
          <ContextMenuItem
            onSelect={() => {
              copyToClipboard(entry.newId, "Commit id");
            }}
          >
            Copy commit id
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
