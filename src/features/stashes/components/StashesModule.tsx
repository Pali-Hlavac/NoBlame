import { ArchiveIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { WithActiveRepository } from "@/features/repositories";
import { showStashTab } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { StashDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useStashes } from "../api/stashes";
import { useStashActions } from "../hooks/useStashActions";
import { showStash, useShownStash } from "../store/shown";
import { openStashChanges } from "../store/stashDialog";
import { DropStashDialog } from "./DropStashDialog";
import { StashItem } from "./StashItem";

interface StashesProps {
  repoId: number;
  repoPath: string;
}

/** The stashes of one repository, with stashing, applying and dropping. */
export function Stashes({ repoId, repoPath }: StashesProps) {
  const stashes = useStashes(repoId);
  const shown = useShownStash(repoPath);
  const actions = useStashActions(repoId, repoPath);
  const [dropping, setDropping] = useState<StashDto | null>(null);

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
  const show = (stash: StashDto): void => {
    if (shown?.id !== stash.id) showStash(repoPath, stash.id);
    showStashTab();
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => {
            openStashChanges(repoId);
          }}
        >
          <ArchiveIcon aria-hidden className="text-kind-stash" />
          Stash changes…
        </Button>
        <span className="flex-1" />
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
        <EmptyState
          icon={ArchiveIcon}
          title="No stashes"
          description="Stash changes to put them aside and get them back later."
          className="flex-1"
        />
      ) : (
        <ul aria-label="Stashes" className="min-h-0 flex-1 overflow-auto p-1">
          {stashes.data.map((stash) => (
            <StashItem
              key={stash.id}
              stash={stash}
              shown={shown?.id === stash.id}
              busy={actions.busy}
              onShow={show}
              onApply={actions.apply}
              onPop={actions.pop}
              onDrop={setDropping}
            />
          ))}
        </ul>
      )}
      <DropStashDialog
        repoId={repoId}
        repoPath={repoPath}
        stash={dropping}
        onClose={() => {
          setDropping(null);
        }}
      />
    </div>
  );
}

/** Stashes module: the active repository's stashes, stashing changes, applying and dropping. */
export function StashesModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <Stashes repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
