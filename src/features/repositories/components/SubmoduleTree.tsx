import { PackageIcon } from "lucide-react";
import { useContext, useState } from "react";

import { useTabsStore } from "@/features/workspace";
import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { openRepositories } from "../hooks/useOpenRepository";
import { repositoryTab } from "../lib/path";
import { OpenTabsContext } from "./openTabsContext";
import { OpenRepositoryActions } from "./RepositoryActionsMenu";
import { RepositoryTreeRow } from "./RepositoryTreeRow";

/** Milestone that adds initializing and updating submodules. */
const SUBMODULE_ACTIONS_MILESTONE = "M7";

/**
 * A submodule and, expanded by default, its own submodules. An open submodule stays here in its
 * parent's tree (it is not listed again as a repository of its own) and is highlighted when it
 * is the active repository.
 */
export function SubmoduleNode({ submodule, depth }: { submodule: SubmoduleDto; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const openTabs = useContext(OpenTabsContext);
  const tabId = repositoryTab(submodule.workDir).id;
  const isOpen = openTabs.ids.has(tabId);
  const hasChildren = submodule.children.length > 0;
  const title = submodule.initialized
    ? `${submodule.workDir}${submodule.url ? `\n${submodule.url}` : ""}`
    : `${submodule.path} is not initialized (initializing arrives in ${SUBMODULE_ACTIONS_MILESTONE})`;
  return (
    <li>
      <RepositoryTreeRow
        icon={PackageIcon}
        label={submodule.path}
        title={title}
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
        actions={
          isOpen && (
            <OpenRepositoryActions
              repository={{ path: submodule.workDir, tabId, title: submodule.path }}
            />
          )
        }
      />
      {hasChildren && expanded && (
        <SubmoduleList submodules={submodule.children} depth={depth + 1} />
      )}
    </li>
  );
}

export function SubmoduleList({
  submodules,
  depth,
}: {
  submodules: readonly SubmoduleDto[];
  depth: number;
}) {
  return (
    <ul>
      {submodules.map((submodule) => (
        <SubmoduleNode key={submodule.path} submodule={submodule} depth={depth} />
      ))}
    </ul>
  );
}
