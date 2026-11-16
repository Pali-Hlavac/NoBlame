import type { ReactNode } from "react";

import { FileContextMenu, type MenuAction } from "@/features/file-menu";
import { openConflicts, showMergeView, useOpenMergeTool } from "@/features/operations";
import { isMovedSubmodule, useCheckOutRecorded } from "@/features/repositories";
import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { canDiscard } from "../lib/discard";

interface StagingMenuProps {
  repoId: number;
  repoPath: string;
  /** The file with the list's cursor. */
  file: WorkingFileDto | undefined;
  /** The files the menu acts on: the chosen ones, else the cursor's. */
  files: WorkingFileDto[];
  /** "Stage" or "Unstage". */
  verb: string;
  busy: boolean;
  onChoose: (file: WorkingFileDto) => void;
  onToggle: (files: WorkingFileDto[]) => void;
  onDiscard?: (files: WorkingFileDto[]) => void;
  onIgnore?: (file: WorkingFileDto) => void;
  children: ReactNode;
}

/** The props the menu's actions read, with what moves submodules back. */
interface ActionProps extends StagingMenuProps {
  checkOutRecorded: (paths: readonly string[]) => void;
}

/** Stage, discard: what the menu offers for several chosen files. */
function manyActions(props: ActionProps): MenuAction[] {
  const { files, busy, onDiscard } = props;
  const count = `${files.length.toLocaleString()} files`;
  const moved = files.filter(isMovedSubmodule).map((file) => file.path);
  const actions: MenuAction[] = [
    {
      label: `${props.verb} ${count}`,
      disabled: busy,
      onSelect: () => {
        props.onToggle(files);
      },
    },
  ];
  if (onDiscard && files.some(canDiscard)) {
    actions.push({
      label: `Discard the changes to ${count}…`,
      disabled: busy,
      onSelect: () => {
        onDiscard(files);
      },
    });
  }
  if (moved.length > 0) {
    actions.push({
      label: `Check out the recorded commits of ${moved.length.toLocaleString()} submodules`,
      disabled: busy,
      onSelect: () => {
        props.checkOutRecorded(moved);
      },
    });
  }
  return actions;
}

/** Resolve a conflicted file, show its diff, stage it, discard or ignore it. */
function oneFileActions(
  props: ActionProps,
  file: WorkingFileDto,
  openMergeTool: (path: string) => void,
): MenuAction[] {
  const { busy, repoId, onDiscard, onIgnore } = props;
  const actions: MenuAction[] = [];
  if (file.status === "conflicted") {
    actions.push(
      {
        label: "Merge in NoBlame",
        onSelect: () => {
          showMergeView(repoId, file.path);
        },
      },
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
        props.onToggle([file]);
      },
    },
  );
  if (onDiscard && canDiscard(file)) {
    actions.push({
      label: "Discard the changes…",
      disabled: busy,
      onSelect: () => {
        onDiscard([file]);
      },
    });
  }
  if (isMovedSubmodule(file)) {
    actions.push({
      label: "Check out the recorded commit",
      disabled: busy,
      onSelect: () => {
        props.checkOutRecorded([file.path]);
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
  return actions;
}

/**
 * The context menu of the Commit module's lists. For one file: show its diff, stage or unstage
 * it, discard or ignore it (as its row's buttons), resolve a conflicted one, then the menu every
 * file list has. For several chosen files: stage or unstage them, or discard their changes.
 */
export function StagingMenu(props: StagingMenuProps) {
  const { file, files } = props;
  const openMergeTool = useOpenMergeTool(props.repoId);
  const checkOutRecorded = useCheckOutRecorded(props.repoPath);
  const withHelpers = { ...props, checkOutRecorded };
  const many = files.length > 1;
  const actions = many
    ? manyActions(withHelpers)
    : file
      ? oneFileActions(withHelpers, file, openMergeTool)
      : [];
  return (
    <FileContextMenu
      repoId={props.repoId}
      repoPath={props.repoPath}
      file={file && { path: file.path }}
      count={many ? files.length : undefined}
      actions={actions}
    >
      {props.children}
    </FileContextMenu>
  );
}
