import { FilePenLineIcon } from "lucide-react";

import { useStatusSummary } from "../api/status";
import { WORKING_TREE_MILESTONE, workingTreeRows, type WorkingTreeKind } from "../lib/rows";

/**
 * A compact summary for the repository header ("3 changed, 1 untracked · 2 staged"), shown when
 * Settings put the working tree changes there. Nothing when the tree is clean.
 */
export function WorkingTreeChip({ repoId }: { repoId: number }) {
  const status = useStatusSummary(repoId);
  const rows = workingTreeRows(status.data);
  if (rows.length === 0) return null;
  const text = rows
    .map((row) => (row.kind === "index" ? `${row.detail} staged` : row.detail))
    .join(" · ");
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 text-xs text-muted-foreground"
      title={`Uncommitted changes: ${text}`}
    >
      <FilePenLineIcon className="size-3" aria-hidden />
      <span className="sr-only">Uncommitted changes:</span>
      {text}
    </span>
  );
}

/**
 * What the Commit details module shows while a working tree row is selected: its counts, and
 * that the file list arrives later (a labelled placeholder until M4).
 */
export function WorkingTreeDetails({ repoId, kind }: { repoId: number; kind: WorkingTreeKind }) {
  const status = useStatusSummary(repoId);
  const row = workingTreeRows(status.data).find((candidate) => candidate.kind === kind);
  return (
    <div className="space-y-2 p-3 text-sm">
      <h2 className="font-semibold">
        {kind === "index" ? "Staged changes" : "Working tree changes"}
      </h2>
      <p>{row ? row.detail : "No changes left."}</p>
      <p className="text-xs text-muted-foreground">
        The changed files, their diffs and staging arrive in {WORKING_TREE_MILESTONE}.
      </p>
    </div>
  );
}
