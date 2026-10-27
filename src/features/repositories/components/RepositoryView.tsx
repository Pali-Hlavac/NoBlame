import { ConstructionIcon, ExternalLinkIcon } from "lucide-react";

import { TASKS, useOpenTaskWindow } from "@/features/windows";
import type { RepositoryTab } from "@/features/workspace";
import type { TaskKind } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

/** Task windows offered from the placeholder, to try the window plumbing. */
const PREVIEW_TASKS: readonly TaskKind[] = ["log", "commit", "fileHistory"];
/** Milestone in `docs/roadmap.md` that opens repositories and draws the graph. */
const REPOSITORY_MILESTONE = "M2";

/**
 * Content of a repository tab. M1 only shows the requested path: reading the repository
 * and the commit graph are milestone M2, and the UI says so.
 */
export function RepositoryView({ tab }: { tab: RepositoryTab }) {
  const openTaskWindow = useOpenTaskWindow();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">{tab.title}</h1>
        <p className="text-sm break-all text-muted-foreground select-text">{tab.path}</p>
      </header>
      <section
        aria-label="Placeholder"
        className="flex gap-3 rounded-md border border-dashed border-border p-4 text-sm"
      >
        <ConstructionIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p>
          Placeholder: the repository is not read yet. Opening repositories and the commit graph
          arrive in milestone {REPOSITORY_MILESTONE}.
        </p>
      </section>
      <section aria-labelledby="task-windows-heading" className="grid gap-3">
        <h2 id="task-windows-heading" className="text-sm font-medium">
          Task windows (placeholders)
        </h2>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_TASKS.map((task) => (
            <Button
              key={task}
              variant="outline"
              size="sm"
              disabled={openTaskWindow.isPending}
              onClick={() => {
                openTaskWindow.mutate({ task, path: tab.path });
              }}
            >
              <ExternalLinkIcon aria-hidden />
              {TASKS[task].title}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
