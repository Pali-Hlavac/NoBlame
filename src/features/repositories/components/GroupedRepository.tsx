import { FolderGitIcon, FolderMinusIcon } from "lucide-react";
import { useContext, useState } from "react";

import type { RepositoryGroup } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { KIND_ICON_CLASSES } from "@/shared/lib/workKinds";

import { useEditGroups } from "../api/groups";
import { useSubmodules } from "../api/submodules";
import { useDropTarget } from "../hooks/useDropTarget";
import { openRepositories } from "../hooks/useOpenRepository";
import {
  droppedRepository,
  isRepositoryDrag,
  onLowerHalf,
  startRepositoryDrag,
} from "../lib/dragData";
import { placeRepository, removeRepository, repositoryDropIndex } from "../lib/groups";
import { repositoryName, repositoryTab } from "../lib/path";
import { OpenTabsContext } from "./openTabsContext";
import { RepositoryChangeCounts } from "./ChangeCounts";
import { RepositoryActions } from "./RepositoryActionsMenu";
import { RepositoryContextMenu } from "./RepositoryContextMenu";
import { RepositoryTreeRow } from "./RepositoryTreeRow";
import { SubmoduleList } from "./SubmoduleTree";

/** Classes of a row while something is dragged over it. */
export const DROP_TARGET_CLASSES = "bg-primary/15 ring-1 ring-primary/60 ring-inset";

interface GroupedRepositoryProps {
  group: RepositoryGroup;
  path: string;
  /** The folder no longer exists. */
  missing: boolean;
}

/**
 * A repository inside a group, with its submodules nested below it as in Open: opens (or shows)
 * its tab on click, can be dragged to another place or group, and takes repositories dropped on
 * it (before it, or after on its lower half).
 */
export function GroupedRepository({ group, path, missing }: GroupedRepositoryProps) {
  const edit = useEditGroups();
  const { ids, paths, activeId } = useContext(OpenTabsContext);
  const tabId = repositoryTab(path).id;
  const name = repositoryName(path);
  // Read from the folder, so they show without opening the repository (as in Open).
  const submodules = useSubmodules(path, !missing).data ?? [];
  const [expanded, setExpanded] = useState(true);
  const drop = useDropTarget(isRepositoryDrag, (event) => {
    const dragged = droppedRepository(event);
    if (!dragged) return;
    const after = onLowerHalf(event);
    edit((groups) => {
      const target = groups.find((each) => each.id === group.id);
      if (!target) return [...groups];
      const index = repositoryDropIndex(target, path, dragged.path, after);
      return placeRepository(groups, dragged.path, group.id, index, dragged.fromGroup);
    });
  });
  return (
    <li>
      <RepositoryContextMenu path={path} groupId={group.id}>
        <RepositoryTreeRow
          icon={FolderGitIcon}
          iconKind="repositories"
          label={name}
          title={missing ? `${path} (folder not found)` : path}
          depth={1}
          expanded={submodules.length > 0 ? expanded : undefined}
          onToggle={() => {
            setExpanded(!expanded);
          }}
          onOpen={() => {
            openRepositories([path]);
          }}
          current={activeId === tabId}
          emphasized={ids.has(tabId)}
          dimmed={missing}
          badge={
            <RepositoryChangeCounts
              path={path}
              sessionPath={paths.get(tabId)}
              available={!missing}
            />
          }
          draggable
          onDragStart={(event) => {
            startRepositoryDrag(event, { path, fromGroup: group.id });
          }}
          className={cn(drop.over && DROP_TARGET_CLASSES)}
          {...drop.props}
          actions={
            <RepositoryActions
              repository={{ path, tabId, title: name, open: ids.has(tabId) }}
              extra={
                <DropdownMenuItem
                  onSelect={() => {
                    edit((groups) => removeRepository(groups, group.id, path));
                  }}
                >
                  <FolderMinusIcon className={KIND_ICON_CLASSES.groups} aria-hidden />
                  Remove from group
                </DropdownMenuItem>
              }
            />
          }
        />
      </RepositoryContextMenu>
      {expanded && submodules.length > 0 && <SubmoduleList submodules={submodules} depth={2} />}
    </li>
  );
}
