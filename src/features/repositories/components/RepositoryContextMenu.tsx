import { FolderIcon, FolderMinusIcon, FolderPlusIcon, FolderInputIcon } from "lucide-react";

import { KIND_ICON_CLASSES } from "@/shared/lib/workKinds";
import type { ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { useEditGroups, useRepositoryGroups } from "../api/groups";
import {
  addGroup,
  freeGroupName,
  groupHas,
  placeRepository,
  removeRepository,
} from "../lib/groups";
import { useGroupsUiStore } from "../store/groups";

interface RepositoryContextMenuProps {
  path: string;
  /** The group the row is shown in, if any. */
  groupId?: string;
  /** The row (its root element receives the trigger's handlers). */
  children: ReactNode;
}

/** Right-click menu of a repository row: add it to a group, or take it out of its group. */
/** Group entries carry the groups' colour. */
const GROUP_ICON = KIND_ICON_CLASSES.groups;

export function RepositoryContextMenu({ path, groupId, children }: RepositoryContextMenuProps) {
  const groups = useRepositoryGroups().data?.groups ?? [];
  const edit = useEditGroups();

  const newGroup = (): void => {
    const id = crypto.randomUUID();
    edit((current) => {
      const rest = groupId ? removeRepository(current, groupId, path) : current;
      return addGroup(rest, id, freeGroupName(rest), [path]);
    });
    useGroupsUiStore.getState().setEditing(id);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderInputIcon className={GROUP_ICON} aria-hidden />
            {groupId ? "Move to group" : "Add to group"}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {groups.map((group) => (
              <ContextMenuItem
                key={group.id}
                disabled={groupHas(group, path)}
                onSelect={() => {
                  edit((current) => placeRepository(current, path, group.id, undefined, groupId));
                }}
              >
                <FolderIcon className={GROUP_ICON} aria-hidden />
                <span className="truncate">{group.name}</span>
              </ContextMenuItem>
            ))}
            {groups.length > 0 && <ContextMenuSeparator />}
            <ContextMenuItem onSelect={newGroup}>
              <FolderPlusIcon className={GROUP_ICON} aria-hidden />
              New group…
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {groupId && (
          <ContextMenuItem
            onSelect={() => {
              edit((current) => removeRepository(current, groupId, path));
            }}
          >
            <FolderMinusIcon className={GROUP_ICON} aria-hidden />
            Remove from group
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
