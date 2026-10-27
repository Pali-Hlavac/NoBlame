import { FolderGitIcon, XIcon } from "lucide-react";

import { ErrorState } from "@/shared/components/ErrorState";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useRecentRepositories, useRemoveRecentRepository } from "../api/recent";
import { openRepositories } from "../hooks/useOpenRepository";

/** Recently opened repositories on the Welcome tab. Missing folders are shown dimmed. */
export function RecentRepositories() {
  const recent = useRecentRepositories();
  const remove = useRemoveRecentRepository();

  if (recent.error) {
    return (
      <ErrorState
        error={recent.error}
        title="Could not load recent repositories"
        onRetry={() => void recent.refetch()}
      />
    );
  }
  if (!recent.data || recent.data.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="w-full text-left">
      <h2 id="recent-heading" className="mb-2 text-sm font-medium text-muted-foreground">
        Recent repositories
      </h2>
      <ul className="grid gap-0.5">
        {recent.data.map((entry) => (
          <li key={entry.path} className="group flex items-center rounded-md hover:bg-accent">
            <button
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !entry.exists && "opacity-50",
              )}
              title={entry.exists ? entry.path : `${entry.path} (folder not found)`}
              onClick={() => {
                openRepositories([entry.path]);
              }}
            >
              <FolderGitIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{entry.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{entry.path}</span>
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="mr-1 size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Remove ${entry.name} from recent repositories`}
              onClick={() => {
                remove.mutate(entry.path);
              }}
            >
              <XIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
