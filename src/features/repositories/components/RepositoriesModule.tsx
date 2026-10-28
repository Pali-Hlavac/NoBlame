import { FolderGitIcon, FolderOpenIcon, FolderPlusIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useTabsStore, type RepositoryTab } from "@/features/workspace";
import type { RecentRepository } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useRecentRepositories, useRemoveRecentRepository } from "../api/recent";
import { useSubmodules } from "../api/submodules";
import {
  openRepositories,
  useCreateRepository,
  useOpenRepository,
} from "../hooks/useOpenRepository";
import { repositoryTab } from "../lib/path";
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

/** An open repository with its submodules nested below it. */
function OpenRepository({ tab, active }: { tab: RepositoryTab; active: boolean }) {
  const submodules = useSubmodules(tab.path);
  const [expanded, setExpanded] = useState(true);
  const children = submodules.data ?? [];
  return (
    <li>
      <RepositoryTreeRow
        icon={FolderGitIcon}
        label={tab.title}
        title={tab.path}
        depth={0}
        expanded={children.length > 0 ? expanded : undefined}
        onToggle={() => {
          setExpanded(!expanded);
        }}
        onOpen={() => {
          useTabsStore.getState().activateTab(tab.id);
        }}
        current={active}
      />
      {expanded && children.length > 0 && <SubmoduleList submodules={children} depth={1} />}
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
          {open.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No repository open.</p>
          ) : (
            <ul>
              {open.map((tab) => (
                <OpenRepository key={tab.id} tab={tab} active={tab.id === activeRepositoryTabId} />
              ))}
            </ul>
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
