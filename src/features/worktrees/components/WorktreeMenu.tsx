import { CopyIcon, FolderOpenIcon, LockIcon, LockOpenIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { openRepositories } from "@/features/repositories";
import { toIpcError } from "@/shared/ipc/client";
import type { WorktreeDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { useUnlockWorktree } from "../api/worktrees";
import { canOpen, folderName } from "../lib/worktrees";
import { useWorktreeDialog } from "../store/dialog";

interface WorktreeMenuProps {
  repoId: number;
  worktree: WorktreeDto;
  children: ReactNode;
}

/** Right-click menu of a worktree: open it, lock or unlock it, remove it, copy its path. */
export function WorktreeMenu({ repoId, worktree, children }: WorktreeMenuProps) {
  const open = useWorktreeDialog((state) => state.open);
  const unlock = useUnlockWorktree(repoId);
  const name = folderName(worktree.path);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`Actions for the worktree ${name}`}>
        <ContextMenuItem
          disabled={!canOpen(worktree)}
          onSelect={() => {
            openRepositories([worktree.path]);
          }}
        >
          <FolderOpenIcon aria-hidden />
          Open
        </ContextMenuItem>
        {!worktree.main &&
          (worktree.locked === null ? (
            <ContextMenuItem
              onSelect={() => {
                open({ kind: "lock", worktree });
              }}
            >
              <LockIcon aria-hidden />
              Lock…
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onSelect={() => {
                unlock.mutate(worktree.path, {
                  onSuccess: () => toast.success(`Unlocked ${name}`),
                  onError: (error) => {
                    toast.error(`Could not unlock ${name}`, {
                      description: toIpcError(error).message,
                    });
                  },
                });
              }}
            >
              <LockOpenIcon aria-hidden />
              Unlock
            </ContextMenuItem>
          ))}
        {!worktree.main && (
          <ContextMenuItem
            disabled={worktree.current || worktree.locked !== null}
            onSelect={() => {
              open({ kind: "remove", worktree });
            }}
          >
            <Trash2Icon aria-hidden />
            Remove…
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            copyToClipboard(worktree.path, "Path");
          }}
        >
          <CopyIcon aria-hidden />
          Copy path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
