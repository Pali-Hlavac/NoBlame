import { FolderGitIcon, FolderOpenIcon } from "lucide-react";

import { useTabsStore } from "@/features/workspace";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useOpenRepository } from "../hooks/useOpenRepository";

/** Sidebar: the open repositories and a button to open another. */
export function RepositoryList() {
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const { activateTab } = useTabsStore.getState();
  const openRepository = useOpenRepository();
  const repositories = tabs.filter((tab) => tab.kind === "repository");

  return (
    <nav aria-label="Repositories" className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Repositories
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Open repository"
          onClick={() => void openRepository()}
        >
          <FolderOpenIcon aria-hidden />
        </Button>
      </div>
      {repositories.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No repository open.</p>
      ) : (
        <ul className="grid gap-0.5">
          {repositories.map((tab) => (
            <li key={tab.id}>
              <button
                title={tab.path}
                aria-current={tab.id === activeTabId ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  tab.id === activeTabId && "bg-accent text-accent-foreground",
                )}
                onClick={() => {
                  activateTab(tab.id);
                }}
              >
                <FolderGitIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{tab.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
