import { PackageIcon } from "lucide-react";
import { useContext, useState } from "react";

import { useTabsStore } from "@/features/workspace";
import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { openRepositories } from "../hooks/useOpenRepository";
import { repositoryTab } from "../lib/path";
import { hasNewCommits, submoduleTitle } from "../lib/submodules";
import { RepositoryChangeCounts } from "./ChangeCounts";
import { OpenTabsContext } from "./openTabsContext";
import { RepositoryActions } from "./RepositoryActionsMenu";
import { RepositoryTreeRow } from "./RepositoryTreeRow";
import {
  SubmoduleContextMenu,
  SubmoduleUpdateItem,
  UninitializedSubmoduleActions,
} from "./SubmoduleMenus";

interface SubmoduleNodeProps {
  submodule: SubmoduleDto;
  /** The work tree of the repository it is in (where git initializes and updates it). */
  parent: string;
  depth: number;
}

/**
 * A submodule and, expanded by default, its own submodules. An open submodule stays here in its
 * parent's tree (it is not listed again as a repository of its own) and is highlighted when it
 * is the active repository. One that is not initialized is dimmed; one checked out at another
 * commit than its parent records says "new commits".
 */
export function SubmoduleNode({ submodule, parent, depth }: SubmoduleNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const openTabs = useContext(OpenTabsContext);
  const tabId = repositoryTab(submodule.workDir).id;
  const isOpen = openTabs.ids.has(tabId);
  const hasChildren = submodule.children.length > 0;
  return (
    <li>
      <SubmoduleContextMenu submodule={submodule} parent={parent}>
        <RepositoryTreeRow
          icon={PackageIcon}
          iconKind="submodules"
          label={submodule.path}
          title={submoduleTitle(submodule)}
          depth={depth}
          expanded={hasChildren ? expanded : undefined}
          onToggle={() => {
            setExpanded(!expanded);
          }}
          onOpen={
            submodule.initialized
              ? () => {
                  if (isOpen) useTabsStore.getState().activateTab(tabId);
                  else openRepositories([submodule.workDir]);
                }
              : undefined
          }
          current={openTabs.activeId === tabId}
          emphasized={isOpen}
          dimmed={!submodule.initialized}
          badge={
            <>
              {hasNewCommits(submodule) && (
                <span className="mr-1 shrink-0 text-xs text-muted-foreground">new commits</span>
              )}
              <RepositoryChangeCounts
                path={submodule.workDir}
                sessionPath={isOpen ? submodule.workDir : undefined}
                available={submodule.initialized}
              />
            </>
          }
          actions={
            submodule.initialized ? (
              <RepositoryActions
                repository={{ path: submodule.workDir, tabId, title: submodule.path, open: isOpen }}
                extra={<SubmoduleUpdateItem submodule={submodule} parent={parent} />}
              />
            ) : (
              <UninitializedSubmoduleActions submodule={submodule} parent={parent} />
            )
          }
        />
      </SubmoduleContextMenu>
      {hasChildren && expanded && (
        <SubmoduleList
          submodules={submodule.children}
          parent={submodule.workDir}
          depth={depth + 1}
        />
      )}
    </li>
  );
}

export function SubmoduleList({
  submodules,
  parent,
  depth,
}: {
  submodules: readonly SubmoduleDto[];
  parent: string;
  depth: number;
}) {
  return (
    <ul>
      {submodules.map((submodule) => (
        <SubmoduleNode key={submodule.path} submodule={submodule} parent={parent} depth={depth} />
      ))}
    </ul>
  );
}
