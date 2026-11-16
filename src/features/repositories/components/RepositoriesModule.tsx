import {
  FolderDownIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  ListPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { useContext, type ReactNode } from "react";

import { useRepositorySections } from "@/features/settings";
import { useTabsStore, type RepositoryTab } from "@/features/workspace";
import type { RepositoriesSection } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";
import { KIND_ICON_CLASSES, type WorkKind } from "@/shared/lib/workKinds";

import { useEditGroups, useRepositoryGroups } from "../api/groups";
import { useRecentRepositories } from "../api/recent";
import { useSubmoduleTrees } from "../api/submodules";
import { useCreateRepository, useOpenRepository } from "../hooks/useOpenRepository";
import { CloneRepositoryContext } from "../lib/actions";
import { addGroup, freeGroupName } from "../lib/groups";
import { repositoryTab } from "../lib/path";
import { moveSection, sectionDropIndex, sectionOrder } from "../lib/sections";
import { submoduleTabIds } from "../lib/submodules";
import { useGroupsUiStore } from "../store/groups";
import { ModuleSection } from "./ModuleSection";
import { OpenTabsContext } from "./openTabsContext";
import { RepositoryGroups } from "./RepositoryGroups";
import { OpenRepository, RecentItem } from "./RepositoryRows";

const SECTION_TITLES: Record<RepositoriesSection, string> = {
  open: "Open",
  groups: "Groups",
  recent: "Recent",
};

/**
 * The module's sections in the saved order (Settings), each foldable and movable. A section
 * whose content is `false` (Recent with nothing closed) is left out.
 */
function ModuleSections(contents: Record<RepositoriesSection, ReactNode>) {
  const sections = useRepositorySections();
  const order = sectionOrder(sections.order);
  const shown = order.filter((id) => contents[id] !== false);
  return shown.map((id) => {
    const collapsed = sections.collapsed.includes(id);
    return (
      <ModuleSection
        key={id}
        id={id}
        title={SECTION_TITLES[id]}
        collapsed={collapsed}
        onToggle={() => {
          sections.setCollapsed(
            collapsed
              ? sections.collapsed.filter((section) => section !== id)
              : [...sections.collapsed, id],
          );
        }}
        onDropSection={(moved, after) => {
          sections.setOrder(moveSection(order, moved, sectionDropIndex(order, id, moved, after)));
        }}
        onMove={(offset) => {
          // Past the neighbour that is shown, also when a hidden section lies between them.
          const neighbour = shown[shown.indexOf(id) + offset];
          if (!neighbour) return;
          sections.setOrder(
            moveSection(order, id, sectionDropIndex(order, neighbour, id, offset > 0)),
          );
        }}
      >
        {contents[id]}
      </ModuleSection>
    );
  });
}

interface ToolbarButtonProps {
  label: string;
  icon: LucideIcon;
  /** Colours the icon: groups or repositories. */
  kind: WorkKind;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, icon: Icon, kind, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={label.replace("…", "")}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className={KIND_ICON_CLASSES[kind]} aria-hidden />
      </Button>
    </Tooltip>
  );
}

/**
 * Repositories module: open repositories with nested submodules, groups, and recent ones, in
 * the order the user arranged.
 */
export function RepositoriesModule() {
  const tabs = useTabsStore((state) => state.tabs);
  const activeRepositoryTabId = useTabsStore((state) => state.activeRepositoryTabId);
  const recent = useRecentRepositories();
  const groupsLoaded = useRepositoryGroups().isSuccess;
  const editGroups = useEditGroups();
  const openRepository = useOpenRepository();
  const createRepository = useCreateRepository();
  const cloneRepository = useContext(CloneRepositoryContext);
  const open = tabs.filter((tab): tab is RepositoryTab => tab.kind === "repository");
  const openIds = new Set(open.map((tab) => tab.id));
  const openPaths = new Map(open.map((tab) => [tab.id, tab.path]));
  const trees = useSubmoduleTrees(open.map((tab) => tab.path)).map((query) => query.data ?? []);
  // Open submodules appear inside their parent's tree, not as repositories of their own.
  const nested = submoduleTabIds(trees);
  const roots = open.flatMap((tab, index) =>
    nested.has(tab.id) ? [] : [{ tab, submodules: trees[index] ?? [] }],
  );
  const closedRecent = (recent.data ?? []).filter(
    (entry) => !openIds.has(repositoryTab(entry.path).id),
  );

  const newGroup = (): void => {
    const id = crypto.randomUUID();
    editGroups((groups) => addGroup(groups, id, freeGroupName(groups)));
    useGroupsUiStore.getState().setEditing(id);
  };

  return (
    <nav aria-label="Repositories" className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
        <ToolbarButton
          label="New group"
          icon={ListPlusIcon}
          kind="groups"
          disabled={!groupsLoaded}
          onClick={newGroup}
        />
        <ToolbarButton
          label="Open repository…"
          icon={FolderOpenIcon}
          kind="repositories"
          onClick={() => void openRepository()}
        />
        <ToolbarButton
          label="Create repository…"
          icon={FolderPlusIcon}
          kind="repositories"
          disabled={createRepository.pending}
          onClick={() => void createRepository.create()}
        />
        {cloneRepository && (
          <ToolbarButton
            label="Clone repository…"
            icon={FolderDownIcon}
            kind="repositories"
            onClick={cloneRepository}
          />
        )}
      </div>
      <OpenTabsContext.Provider
        value={{ ids: openIds, paths: openPaths, activeId: activeRepositoryTabId }}
      >
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-1">
          <ModuleSections
            open={
              roots.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">No repository open.</p>
              ) : (
                <ul>
                  {roots.map(({ tab, submodules }) => (
                    <OpenRepository
                      key={tab.id}
                      tab={tab}
                      active={tab.id === activeRepositoryTabId}
                      submodules={submodules}
                    />
                  ))}
                </ul>
              )
            }
            groups={<RepositoryGroups />}
            recent={
              closedRecent.length > 0 && (
                <ul>
                  {closedRecent.map((entry) => (
                    <RecentItem key={entry.path} entry={entry} />
                  ))}
                </ul>
              )
            }
          />
        </div>
      </OpenTabsContext.Provider>
    </nav>
  );
}
