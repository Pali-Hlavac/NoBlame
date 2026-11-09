import type { ReactNode } from "react";

import { FileContextMenu, type MenuAction } from "@/features/file-menu";
import { openConflicts, useOpenMergeTool } from "@/features/operations";
import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { canDiscard } from "../lib/discard";

interface StagingMenuProps {
  repoId: number;
  repoPath: string;
  /** The file with the list's cursor, and its index. */
  file: WorkingFileDto | undefined;
  index: number;
  /** "Stage" or "Unstage". */
  verb: string;
  busy: boolean;
  onChoose: (file: WorkingFileDto) => void;
  onToggle: (file: WorkingFileDto, index: number) => void;
  onDiscard?: (file: WorkingFileDto) => void;
  onIgnore?: (file: WorkingFileDto) => void;
  children: ReactNode;
}

/**
 * The context menu of a file in the Commit module's lists: show its diff, stage or unstage it,
 * discard or ignore it (as its row's buttons), resolve a conflicted one, then the menu every
 * file list has.
 */
export function StagingMenu(props: StagingMenuProps) {
  const { file, index, busy, repoId } = props;
  const openMergeTool = useOpenMergeTool(repoId);
  const actions: MenuAction[] = [];
  if (file?.status === "conflicted") {
    actions.push(
      {
        label: "Open in merge tool",
        onSelect: () => {
          openMergeTool(file.path);
        },
      },
      {
        label: "Resolve conflicts…",
        onSelect: () => {
          openConflicts(repoId);
        },
      },
    );
  }
  if (file) {
    actions.push(
      {
        label: "Show diff",
        onSelect: () => {
          props.onChoose(file);
        },
      },
      {
        label: props.verb,
        disabled: busy,
        onSelect: () => {
          props.onToggle(file, index);
        },
      },
    );
    const { onDiscard, onIgnore } = props;
    if (onDiscard && canDiscard(file)) {
      actions.push({
        label: "Discard the changes…",
        disabled: busy,
        onSelect: () => {
          onDiscard(file);
        },
      });
    }
    if (onIgnore && file.status === "untracked") {
      actions.push({
        label: "Ignore…",
        disabled: busy,
        onSelect: () => {
          onIgnore(file);
        },
      });
    }
  }
  return (
    <FileContextMenu
      repoId={props.repoId}
      repoPath={props.repoPath}
      file={file && { path: file.path }}
      actions={actions}
    >
      {props.children}
    </FileContextMenu>
  );
}
