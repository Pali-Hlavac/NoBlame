import { CircleCheckIcon } from "lucide-react";

import { useWorkingTreeStatus } from "@/features/working-tree";
import { EmptyState } from "@/shared/components/EmptyState";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import type { ConflictDto, SideDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useConflicts, useOpenMergeTool, useResolve } from "../api/conflicts";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { KIND_WORDS, canMergeInTool, hasOurs, hasTheirs, sideNames } from "../lib/conflicts";
import { showMergeView } from "../store/mergeView";

interface ConflictsDialogProps {
  repoId: number;
  onClose: () => void;
}

/**
 * The conflicted files, each with Merge (the built-in merge view, in its own tab), Open in merge
 * tool, Use ours, Use theirs and Mark resolved.
 * The list follows the status, so files resolved elsewhere (a merge tool, an editor and
 * staging, a terminal) leave it by themselves.
 */
export function ConflictsDialog({ repoId, onClose }: ConflictsDialogProps) {
  const conflicts = useConflicts(repoId);
  const resolve = useResolve(repoId);
  const openMergeTool = useOpenMergeTool(repoId);
  const head = useCurrentBranch(repoId);
  const operation = useWorkingTreeStatus(repoId).data?.operation;
  const names = sideNames(operation, head === "HEAD" ? "your branch" : head);
  const files = conflicts.data ?? [];
  const run = (paths: string[], side: SideDto | "asIs") => {
    resolve.mutate({ paths, side });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve conflicts</DialogTitle>
          <DialogDescription>
            Ours: {names.ours}. Theirs: {names.theirs}. Taking a side keeps that whole version of
            the file; for a mix, merge it here or in the merge tool, or edit it and mark it
            resolved.
          </DialogDescription>
        </DialogHeader>
        {conflicts.isPending ? (
          <LoadingState label="Reading the conflicts…" />
        ) : files.length === 0 ? (
          <EmptyState
            icon={CircleCheckIcon}
            title="No conflicts left"
            description="Close this and choose Continue in the bar above the commits."
          />
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-auto rounded-md border border-border">
            {files.map((file) => (
              <ConflictRow
                key={file.path}
                file={file}
                busy={resolve.isPending}
                onMerge={() => {
                  showMergeView(repoId, file.path);
                  onClose();
                }}
                onMergeTool={() => {
                  openMergeTool(file.path);
                }}
                onResolve={(side) => {
                  run([file.path], side);
                }}
              />
            ))}
          </ul>
        )}
        {conflicts.error ? <InlineError error={conflicts.error} /> : null}
        {resolve.error ? <InlineError error={resolve.error} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {files.length > 1 ? (
            <>
              <Button
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => {
                  run(
                    files.map((file) => file.path),
                    "ours",
                  );
                }}
              >
                Use ours for all
              </Button>
              <Button
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => {
                  run(
                    files.map((file) => file.path),
                    "theirs",
                  );
                }}
              >
                Use theirs for all
              </Button>
            </>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ConflictRowProps {
  file: ConflictDto;
  busy: boolean;
  onMerge: () => void;
  onMergeTool: () => void;
  onResolve: (side: SideDto | "asIs") => void;
}

function ConflictRow({ file, busy, onMerge, onMergeTool, onResolve }: ConflictRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono" title={file.path}>
          {file.path}
        </span>
        <span className="block text-xs text-muted-foreground">{KIND_WORDS[file.kind]}</span>
      </span>
      {canMergeInTool(file.kind) ? (
        <>
          <Button
            size="sm"
            className="h-7"
            aria-label={`Merge ${file.path} here`}
            title="Merge the lines in NoBlame's merge view"
            onClick={onMerge}
          >
            Merge
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={onMergeTool}>
            Merge tool
          </Button>
        </>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={busy}
        aria-label={`Use ours for ${file.path}`}
        onClick={() => {
          onResolve("ours");
        }}
      >
        {hasOurs(file.kind) ? "Use ours" : "Use ours (delete)"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={busy}
        aria-label={`Use theirs for ${file.path}`}
        onClick={() => {
          onResolve("theirs");
        }}
      >
        {hasTheirs(file.kind) ? "Use theirs" : "Use theirs (delete)"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={busy}
        aria-label={`Mark ${file.path} resolved`}
        title="Stage the file as it is now (after you fixed it in an editor)"
        onClick={() => {
          onResolve("asIs");
        }}
      >
        Mark resolved
      </Button>
    </li>
  );
}
