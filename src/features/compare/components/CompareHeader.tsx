import { ArrowLeftRightIcon, ArrowRightIcon } from "lucide-react";

import { shortId } from "@/features/graph";
import type { Comparison } from "@/features/selection";
import type { ComparedCommitDto, ComparisonDto } from "@/shared/ipc/bindings";

import { useAheadBehind } from "../api/compare";
import { canSwap, describeAheadBehind, describeFileCount, swapped } from "../lib/revisions";
import { RevisionPicker } from "./RevisionPicker";

function describeCommit(commit: ComparedCommitDto | undefined): string | undefined {
  return commit && `${shortId(commit.id)} ${commit.summary}`;
}

interface CompareHeaderProps {
  repoId: number;
  comparison: Comparison;
  onChange: (comparison: Comparison) => void;
  /** The last comparison read, for the commits and counts. */
  result: ComparisonDto | undefined;
}

/** Both revisions, swapping them, the merge base option, and what differs. */
export function CompareHeader({ repoId, comparison, onChange, result }: CompareHeaderProps) {
  const counts = useAheadBehind(repoId, result?.base.id, result?.target.id);
  const facts = [];
  if (result) facts.push(describeFileCount(result.total, result.files.length));
  if (counts.data) facts.push(describeAheadBehind(counts.data, comparison));
  if (result?.mergeBase) facts.push(`split at ${describeCommit(result.mergeBase) ?? ""}`);
  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <RevisionPicker
          repoId={repoId}
          side="Compare from"
          revision={comparison.base}
          detail={describeCommit(result?.base)}
          onChange={(base) => {
            onChange({ ...comparison, base });
          }}
        />
        <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <RevisionPicker
          repoId={repoId}
          side="Compare to"
          revision={comparison.target}
          detail={
            result?.worktree
              ? `Your files, on ${describeCommit(result.target) ?? "HEAD"}`
              : describeCommit(result?.target)
          }
          withWorkingTree
          onChange={(target) => {
            onChange({ ...comparison, target });
          }}
        />
        <button
          type="button"
          aria-label="Swap the two sides"
          title={
            canSwap(comparison)
              ? "Swap the two sides"
              : "The working tree can only be the second side"
          }
          disabled={!canSwap(comparison)}
          className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
          onClick={() => {
            onChange(swapped(comparison));
          }}
        >
          <ArrowLeftRightIcon className="size-4" aria-hidden />
        </button>
        <label
          className="flex items-center gap-1.5 text-sm"
          title="Show only what the second side changed since the two split (git diff A...B)"
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={comparison.sinceMergeBase}
            onChange={(event) => {
              onChange({ ...comparison, sinceMergeBase: event.target.checked });
            }}
          />
          Only changes since they split
        </label>
      </div>
      {facts.length > 0 && (
        <p className="truncate text-xs text-muted-foreground" title={facts.join(" · ")}>
          {facts.join(" · ")}
        </p>
      )}
      {result?.exactRenamesOnly && (
        <p className="text-xs text-muted-foreground">
          This partial clone lacks the old file contents, so only files moved without changes are
          shown as renames; an edited, moved file is listed as deleted and added.
        </p>
      )}
    </div>
  );
}
