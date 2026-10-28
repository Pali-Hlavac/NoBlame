import { FolderGitIcon, FolderOpenIcon, FolderPlusIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useTabsStore, type RepositoryTab } from "@/features/workspace";
import type { RecentRepository, SubmoduleDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useRecentRepositories, useRemoveRecentRepository } from "../api/recent";
import { useSubmoduleTrees } from "../api/submodules";
import {
  openRepositories,
  useCreateRepository,
  useOpenRepository,
} from "../hooks/useOpenRepository";
import { repositoryTab } from "../lib/path";
import { submoduleTabIds } from "../lib/submodules";
import { OpenTabsContext } from "./openTabsContext";
import { OpenRepositoryActions } from "./RepositoryActionsMenu";
import { RepositoryTreeRow } from "./RepositoryTreeRow";
import { SubmoduleList } from "./SubmoduleTree";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-0.5">
      <h3 className="px-2 pt-2 text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

interface OpenRepositoryProps {
  tab: RepositoryTab;
  active: boolean;
  submodules: readonly SubmoduleDto[];
}

/** An open repository with its submodules nested below it. */
function OpenRepository({ tab, active, submodules }: OpenRepositoryProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li>
      <RepositoryTreeRow
        icon={FolderGitIcon}
        label={tab.title}
        title={tab.path}
        depth={0}
        expanded={submodules.length > 0 ? expanded : undefined}
        onToggle={() => {
          setExpanded(!expanded);
        }}
        onOpen={() => {
          useTabsStore.getState().activateTab(tab.id);
        }}
        current={active}
        actions={
          <OpenRepositoryActions repository={{ path: tab.path, tabId: tab.id, title: tab.title }} />
        }
      />
      {expanded && submodules.length > 0 && <SubmoduleList submodules={submodules} depth={1} />}
    </li>
  );
}

function RecentItem({ entry }: { entry: RecentRepository }) {
  const remove = useRemoveRecentRepository();
  return (
    <li>
      <RepositoryTreeRow
        icon={FolderGitIcon}
        label={entry.name}
        title={entry.exists ? entry.path : `${entry.path} (folder not found)`}
        depth={0}
        expanded={undefined}
        onOpen={() => {
          openRepositories([entry.path]);
        }}
        dimmed={!entry.exists}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="mr-1 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Remove ${entry.name} from recent repositories`}
            onClick={() => {
              remove.mutate(entry.path);
            }}
          >
            <XIcon aria-hidden />
          </Button>
        }
      />
    </li>
  );
}

/** Repositories module: open repositories with nested submodules, then recent ones. */
export function RepositoriesModule() {
  const tabs = useTabsStore((state) => state.tabs);
  const activeRepositoryTabId = useTabsStore((state) => state.activeRepositoryTabId);
  const recent = useRecentRepositories();
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

  return (
    <nav aria-label="Repositories" className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
        <Tooltip content="Open repository…">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Open repository"
            onClick={() => void openRepository()}
          >
            <FolderOpenIcon aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip content="Create repository…">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Create repository"
            disabled={createRepository.pending}
            onClick={() => void createRepository.create()}
          >
            <FolderPlusIcon aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-1">
        <Section title="Open">
          {roots.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No repository open.</p>
          ) : (
            <OpenTabsContext.Provider value={{ ids: openIds, activeId: activeRepositoryTabId }}>
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
            </OpenTabsContext.Provider>
          )}
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
    </nav>
  );
}
