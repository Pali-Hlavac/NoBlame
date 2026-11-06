import { FolderClosedIcon, FolderOpenIcon } from "lucide-react";
import { useContext, useState } from "react";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { RepositoryGroup } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { useEditGroups } from "../api/groups";
import { useDropTarget } from "../hooks/useDropTarget";
import { openRepositories } from "../hooks/useOpenRepository";
import {
  droppedGroup,
  droppedRepository,
  isGroupDrag,
  isRepositoryDrag,
  onLowerHalf,
  startGroupDrag,
} from "../lib/dragData";
import {
  groupDropIndex,
  moveGroup,
  placeRepository,
  removeGroup,
  renameGroup,
  setCollapsed,
} from "../lib/groups";
import { GroupActionsContext, type GroupTarget } from "../lib/actions";
import { useGroupsUiStore } from "../store/groups";
import { DROP_TARGET_CLASSES, GroupedRepository } from "./GroupedRepository";
import { GroupActionsButton, GroupContextMenu, type GroupMenuActions } from "./GroupMenu";
import { GroupNameField } from "./GroupNameField";
import { GroupQuickButtons } from "./QuickButtons";
import { RepositoryTreeRow } from "./RepositoryTreeRow";

interface GroupItemProps {
  group: RepositoryGroup;
  index: number;
  count: number;
  /** Paths whose folders no longer exist. */
  missing: ReadonlySet<string>;
}

/**
 * A group: a folder row (click folds it, F2 renames it, drag it to reorder; repositories dropped
 * on it go to its end) and its repositories below.
 */
export function GroupItem({ group, index, count, missing }: GroupItemProps) {
  const edit = useEditGroups();
  const editing = useGroupsUiStore((state) => state.editingId === group.id);
  const setEditing = useGroupsUiStore((state) => state.setEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const drop = useDropTarget(
    (event) => isRepositoryDrag(event) || isGroupDrag(event),
    (event) => {
      const draggedGroup = droppedGroup(event);
      if (draggedGroup !== undefined) {
        if (draggedGroup === group.id) return;
        const after = onLowerHalf(event);
        edit((groups) =>
          moveGroup(groups, draggedGroup, groupDropIndex(groups, group.id, draggedGroup, after)),
        );
        return;
      }
      const dragged = droppedRepository(event);
      if (dragged) {
        edit((groups) =>
          placeRepository(groups, dragged.path, group.id, undefined, dragged.fromGroup),
        );
      }
    },
  );

  const remove = (): void => {
    edit((groups) => removeGroup(groups, group.id));
  };
  const target: GroupTarget = { name: group.name, paths: group.repositories };
  const forAll = useContext(GroupActionsContext).map((action) => ({
    id: action.id,
    label: action.label,
    icon: action.icon,
    kind: action.kind,
    onSelect: () => {
      action.run(target);
    },
    disabled: group.repositories.length === 0,
  }));
  const actions: GroupMenuActions = {
    hasRepositories: group.repositories.length > 0,
    forAll,
    canMoveUp: index > 0,
    canMoveDown: index < count - 1,
    onOpenAll: () => {
      openRepositories(group.repositories);
    },
    onRename: () => {
      setEditing(group.id);
    },
    onMove: (offset) => {
      edit((groups) => moveGroup(groups, group.id, index + offset));
    },
    onDelete: () => {
      if (group.repositories.length > 0) setConfirmDelete(true);
      else remove();
    },
  };
  const expanded = !group.collapsed;
  const toggle = (): void => {
    edit((groups) => setCollapsed(groups, group.id, expanded));
  };

  return (
    <li>
      <GroupContextMenu actions={actions}>
        <RepositoryTreeRow
          icon={expanded ? FolderOpenIcon : FolderClosedIcon}
          iconKind="groups"
          label={group.name}
          title={`${group.name}: ${group.repositories.length} repositories`}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          onOpen={toggle}
          emphasized
          draggable={!editing}
          onDragStart={(event) => {
            startGroupDrag(event, group.id);
          }}
          onKeyDown={(event) => {
            if (event.key === "F2" && !editing) {
              event.preventDefault();
              setEditing(group.id);
            }
          }}
          className={cn(drop.over && DROP_TARGET_CLASSES)}
          labelSlot={
            editing ? (
              <GroupNameField
                name={group.name}
                onCommit={(name) => {
                  edit((groups) => renameGroup(groups, group.id, name));
                }}
                onDone={() => {
                  setEditing(null);
                }}
              />
            ) : undefined
          }
          actions={
            <>
              <GroupQuickButtons group={target} />
              <span className="px-1 text-xs text-muted-foreground tabular-nums">
                {group.repositories.length}
              </span>
              <GroupActionsButton name={group.name} actions={actions} />
            </>
          }
          {...drop.props}
        />
      </GroupContextMenu>
      {expanded && (
        <ul>
          {group.repositories.length === 0 ? (
            <li className="py-1 pl-10 text-xs text-muted-foreground">
              Drag repositories here, or right-click one → Add to group.
            </li>
          ) : (
            group.repositories.map((path) => (
              <GroupedRepository key={path} group={group} path={path} missing={missing.has(path)} />
            ))
          )}
        </ul>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete the group "${group.name}"?`}
        description={`The ${group.repositories.length} repositories in it stay where they are on disk; only the group and its order are removed.`}
        confirmLabel="Delete group"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          remove();
        }}
      />
    </li>
  );
}
