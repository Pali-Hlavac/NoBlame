import { ArchiveIcon, RefreshCwIcon } from "lucide-react";

import { formatCommitDate } from "@/features/graph";
import { WithActiveRepository } from "@/features/repositories";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { StashDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useStashes } from "../api/stashes";

/** Milestone that adds creating, applying, popping and dropping stashes. */
const STASH_ACTIONS_MILESTONE = "M4";

/** The message without git's `WIP on <branch>:` / `On <branch>:` prefix. */
function description(stash: StashDto): string {
  const separator = stash.message.indexOf(": ");
  return stash.branch && separator !== -1 ? stash.message.slice(separator + 2) : stash.message;
}

function StashItem({ stash }: { stash: StashDto }) {
  return (
    <li className="space-y-0.5 rounded-md px-2 py-1.5 hover:bg-muted/60" title={stash.id}>
      <div className="flex items-baseline gap-2">
        <code className="shrink-0 font-mono text-xs text-muted-foreground">
          stash@{`{${stash.index}}`}
        </code>
        <span className="truncate text-sm">{description(stash)}</span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {stash.branch ? `on ${stash.branch} · ` : ""}
        {formatCommitDate(stash.time)}
      </p>
    </li>
  );
}

function Stashes({ repoId }: { repoId: number }) {
  const stashes = useStashes(repoId);
  if (stashes.error) {
    return (
      <ErrorState
        error={stashes.error}
        title="Could not read the stashes"
        onRetry={() => void stashes.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!stashes.data) return <LoadingState label="Reading stashes…" className="h-full" />;
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span className="flex-1">
          Read-only: creating, applying and dropping stashes arrive in {STASH_ACTIONS_MILESTONE}.
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Refresh stashes"
          disabled={stashes.isFetching}
          onClick={() => void stashes.refetch()}
        >
          <RefreshCwIcon aria-hidden />
        </Button>
      </div>
      {stashes.data.length === 0 ? (
        <EmptyState icon={ArchiveIcon} title="No stashes" className="flex-1" />
      ) : (
        <ul aria-label="Stashes" className="min-h-0 flex-1 overflow-auto p-1">
          {stashes.data.map((stash) => (
            <StashItem key={stash.id} stash={stash} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Stashes module: the stash list of the active repository (read-only until M4). */
export function StashesModule() {
  return (
    <WithActiveRepository>{(summary) => <Stashes repoId={summary.id} />}</WithActiveRepository>
  );
}
