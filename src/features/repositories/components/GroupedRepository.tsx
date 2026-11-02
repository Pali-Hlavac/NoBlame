import { FolderGitIcon } from "lucide-react";
import { useContext } from "react";

import type { RepositoryGroup } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { useEditGroups } from "../api/groups";
import { useDropTarget } from "../hooks/useDropTarget";
import { openRepositories } from "../hooks/useOpenRepository";
import {
  droppedRepository,
  isRepositoryDrag,
  onLowerHalf,
  startRepositoryDrag,
} from "../lib/dragData";
import { placeRepository, repositoryDropIndex } from "../lib/groups";
import { repositoryName, repositoryTab } from "../lib/path";
import { OpenTabsContext } from "./openTabsContext";
import { RepositoryContextMenu } from "./RepositoryContextMenu";
import { RepositoryTreeRow } from "./RepositoryTreeRow";

/** Classes of a row while something is dragged over it. */
export const DROP_TARGET_CLASSES = "bg-primary/15 ring-1 ring-primary/60 ring-inset";

interface GroupedRepositoryProps {
  group: RepositoryGroup;
  path: string;
  /** The folder no longer exists. */
  missing: boolean;
}

/**
 * A repository inside a group: opens (or shows) its tab on click, can be dragged to another
 * place or group, and takes repositories dropped on it (before it, or after on its lower half).
 */
export function GroupedRepository({ group, path, missing }: GroupedRepositoryProps) {
  const edit = useEditGroups();
  const { ids, activeId } = useContext(OpenTabsContext);
  const tabId = repositoryTab(path).id;
  const name = repositoryName(path);
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
          label={name}
          title={missing ? `${path} (folder not found)` : path}
          depth={1}
          expanded={undefined}
          onOpen={() => {
            openRepositories([path]);
          }}
          current={activeId === tabId}
          emphasized={ids.has(tabId)}
          dimmed={missing}
          draggable
          onDragStart={(event) => {
            startRepositoryDrag(event, { path, fromGroup: group.id });
          }}
          className={cn(drop.over && DROP_TARGET_CLASSES)}
          {...drop.props}
        />
      </RepositoryContextMenu>
    </li>
  );
}
