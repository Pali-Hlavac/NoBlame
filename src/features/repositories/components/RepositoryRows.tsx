import { FolderGitIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { useTabsStore, type RepositoryTab } from "@/features/workspace";
import type { RecentRepository, SubmoduleDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useRemoveRecentRepository } from "../api/recent";
import { openRepositories } from "../hooks/useOpenRepository";
import { startRepositoryDrag } from "../lib/dragData";
import { repositoryTab } from "../lib/path";
import { RepositoryChangeCounts } from "./ChangeCounts";
import { RepositoryActions } from "./RepositoryActionsMenu";
import { RepositoryContextMenu } from "./RepositoryContextMenu";
import { RepositoryQuickButtons } from "./QuickButtons";
import { RepositoryTreeRow } from "./RepositoryTreeRow";
import { UpdateAllSubmodulesItem } from "./SubmoduleMenus";
import { SubmoduleList } from "./SubmoduleTree";

interface OpenRepositoryProps {
  tab: RepositoryTab;
  active: boolean;
  submodules: readonly SubmoduleDto[];
}

/** An open repository with its submodules nested below it; drag it onto a group to add it. */
export function OpenRepository({ tab, active, submodules }: OpenRepositoryProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li>
      <RepositoryContextMenu path={tab.path}>
        <RepositoryTreeRow
          icon={FolderGitIcon}
          iconKind="repositories"
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
          badge={<RepositoryChangeCounts path={tab.path} sessionPath={tab.path} />}
          draggable
          onDragStart={(event) => {
            startRepositoryDrag(event, { path: tab.path });
          }}
          actions={<OpenRepositoryActions tab={tab} submodules={submodules} />}
        />
      </RepositoryContextMenu>
      {expanded && submodules.length > 0 && (
        <SubmoduleList submodules={submodules} parent={tab.path} depth={1} />
      )}
    </li>
  );
}

/** An open repository's quick buttons and "…" menu. */
function OpenRepositoryActions({
  tab,
  submodules,
}: {
  tab: RepositoryTab;
  submodules: readonly SubmoduleDto[];
}) {
  const repository = { path: tab.path, tabId: tab.id, title: tab.title, open: true };
  return (
    <>
      <RepositoryQuickButtons repository={repository} />
      <RepositoryActions
        repository={repository}
        extra={
          submodules.length > 0 && (
            <UpdateAllSubmodulesItem path={tab.path} submodules={submodules} />
          )
        }
      />
    </>
  );
}

/** A recently opened repository that is not open; drag it onto a group to add it. */
export function RecentItem({ entry }: { entry: RecentRepository }) {
  const remove = useRemoveRecentRepository();
  return (
    <li>
      <RepositoryContextMenu path={entry.path}>
        <RepositoryTreeRow
          icon={FolderGitIcon}
          iconKind="repositories"
          label={entry.name}
          title={entry.exists ? entry.path : `${entry.path} (folder not found)`}
          depth={0}
          expanded={undefined}
          onOpen={() => {
            openRepositories([entry.path]);
          }}
          dimmed={!entry.exists}
          badge={
            <RepositoryChangeCounts
              path={entry.path}
              sessionPath={undefined}
              available={entry.exists}
            />
          }
          draggable
          onDragStart={(event) => {
            startRepositoryDrag(event, { path: entry.path });
          }}
          actions={
            <>
              {entry.exists && (
                <RepositoryQuickButtons
                  repository={{
                    path: entry.path,
                    tabId: repositoryTab(entry.path).id,
                    title: entry.name,
                    open: false,
                  }}
                />
              )}
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
            </>
          }
        />
      </RepositoryContextMenu>
    </li>
  );
}
