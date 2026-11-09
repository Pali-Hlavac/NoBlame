import { CircleCheckIcon, FileWarningIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import type { UnmergeableDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useConflicts } from "../api/conflicts";
import { canMergeInTool } from "../lib/conflicts";
import { UNMERGEABLE_WORDS } from "../lib/mergeView";
import { showMergeView } from "../store/mergeView";
import { openConflicts } from "../store/dialog";

interface MergeUnavailableProps {
  repoId: number;
  path: string;
  reason: UnmergeableDto;
}

/**
 * Why the file is not merged here. When it no longer conflicts (saved, or resolved elsewhere),
 * the next conflicted file is offered.
 */
export function MergeUnavailable({ repoId, path, reason }: MergeUnavailableProps) {
  const conflicts = useConflicts(repoId);
  const files = conflicts.data ?? [];
  const next = files.find((file) => canMergeInTool(file.kind) && file.path !== path);
  const resolveButton =
    files.length > 0 ? (
      <Button
        variant="outline"
        onClick={() => {
          openConflicts(repoId);
        }}
      >
        Resolve conflicts…
      </Button>
    ) : null;

  if (reason !== "noConflict") {
    return (
      <EmptyState
        icon={FileWarningIcon}
        title={`${path} cannot be merged here`}
        description={UNMERGEABLE_WORDS[reason]}
        action={resolveButton}
        className="flex-1"
      />
    );
  }
  const left = files.length;
  return (
    <EmptyState
      icon={CircleCheckIcon}
      title={`${path} has no conflict`}
      description={
        left === 0
          ? "No conflicts are left. Choose Continue in the bar above the commits."
          : `${String(left)} conflicted ${left === 1 ? "file is" : "files are"} left.`
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {next ? (
            <Button
              onClick={() => {
                showMergeView(repoId, next.path);
              }}
            >
              Merge {next.path}
            </Button>
          ) : null}
          {resolveButton}
        </div>
      }
      className="flex-1"
    />
  );
}
