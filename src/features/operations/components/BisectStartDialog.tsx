import type { StartPoint } from "@/features/graph";
import { useWorkingTreeStatus } from "@/features/working-tree";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { BisectMarkDto } from "@/shared/ipc/bindings";

import { useBisectMark } from "../api/bisect";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { MARK_WORDS, bisectToast } from "../lib/bisect";
import { showOutcome } from "../lib/outcome";
import { rememberCounts } from "../store/bisect";

interface BisectStartDialogProps {
  repoId: number;
  commit: StartPoint;
  mark: BisectMarkDto;
  onClose: () => void;
}

/** Explains bisecting before the first mark starts it. */
export function BisectStartDialog({ repoId, commit, mark, onClose }: BisectStartDialogProps) {
  const start = useBisectMark(repoId);
  const branch = useCurrentBranch(repoId);
  const status = useWorkingTreeStatus(repoId).data;
  // Changes to tracked files travel with each checkout (untracked files rarely get in the way).
  const changed = status ? status.summary.staged + status.summary.unstaged : 0;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Start bisecting?"
      description={
        <>
          <span className="block">
            Bisecting finds the commit that brought a problem in. This marks {commit.label} as{" "}
            {MARK_WORDS[mark]}; then mark a {mark === "bad" ? "good" : "bad"} one. NoBlame checks
            out the commit halfway between: test it and choose Good or Bad in the bar above the
            commits, until the first bad commit is found (a few steps, even for thousands of
            commits).
          </span>
          <span className="mt-2 block">
            HEAD is detached while bisecting; Stop bisecting goes back to {branch}.
          </span>
          {changed > 0 && (
            <span className="mt-2 block text-foreground">
              You have uncommitted changes: they come along to each commit tested, and Git refuses
              to check out one they are in the way of. Commit or stash them first to be safe.
            </span>
          )}
        </>
      }
      confirmLabel="Start bisecting"
      pending={start.isPending}
      error={start.error}
      onConfirm={() => {
        start.mutate(
          { mark, commit: commit.revision },
          {
            onSuccess: (result) => {
              rememberCounts(repoId, result.outcome);
              showOutcome(bisectToast(mark, result.outcome));
              onClose();
            },
          },
        );
      }}
    />
  );
}
