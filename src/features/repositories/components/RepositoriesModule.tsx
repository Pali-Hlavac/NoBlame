import { FolderOpenIcon, FolderPlusIcon, ListPlusIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useTabsStore, type RepositoryTab } from "@/features/workspace";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useEditGroups, useRepositoryGroups } from "../api/groups";
import { useRecentRepositories } from "../api/recent";
import { useSubmoduleTrees } from "../api/submodules";
import { useCreateRepository, useOpenRepository } from "../hooks/useOpenRepository";
import { addGroup, freeGroupName } from "../lib/groups";
import { repositoryTab } from "../lib/path";
import { submoduleTabIds } from "../lib/submodules";
import { useGroupsUiStore } from "../store/groups";
import { OpenTabsContext } from "./openTabsContext";
import { RepositoryGroups } from "./RepositoryGroups";
import { OpenRepository, RecentItem } from "./RepositoryRows";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-0.5">
      <h3 className="px-2 pt-2 text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

interface ToolbarButtonProps {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, icon: Icon, disabled, onClick }: ToolbarButtonProps) {
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
        <Icon aria-hidden />
      </Button>
    </Tooltip>
  );
}

/** Repositories module: open repositories with nested submodules, groups, then recent ones. */
export function RepositoriesModule() {
  const tabs = useTabsStore((state) => state.tabs);
  const activeRepositoryTabId = useTabsStore((state) => state.activeRepositoryTabId);
  const recent = useRecentRepositories();
  const groupsLoaded = useRepositoryGroups().isSuccess;
  const editGroups = useEditGroups();
  const openRepository = useOpenRepository();
  const createRepository = useCreateRepository();
  const open = tabs.filter((tab): tab is RepositoryTab => tab.kind === "repository");
  const openIds = new Set(open.map((tab) => tab.id));
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
          disabled={!groupsLoaded}
          onClick={newGroup}
        />
        <ToolbarButton
          label="Open repository…"
          icon={FolderOpenIcon}
          onClick={() => void openRepository()}
        />
        <ToolbarButton
          label="Create repository…"
          icon={FolderPlusIcon}
          disabled={createRepository.pending}
          onClick={() => void createRepository.create()}
        />
      </div>
      <OpenTabsContext.Provider value={{ ids: openIds, activeId: activeRepositoryTabId }}>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-1">
          <Section title="Open">
            {roots.length === 0 ? (
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
            )}
          </Section>
          <Section title="Groups">
            <RepositoryGroups />
          </Section>
          {closedRecent.length > 0 && (
            <Section title="Recent">
              <ul>
                {closedRecent.map((entry) => (
                  <RecentItem key={entry.path} entry={entry} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      </OpenTabsContext.Provider>
    </nav>
  );
}
