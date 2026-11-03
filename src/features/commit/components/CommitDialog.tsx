import { MousePointerClickIcon } from "lucide-react";
import { toast } from "sonner";

import { WorkingTreeDiff } from "@/features/diff";
import { WithActiveRepository } from "@/features/repositories";
import { useSelectedFile, useSelection } from "@/features/selection";
import type { RepoSummary } from "@/shared/ipc/bindings";
import { EmptyState } from "@/shared/components/EmptyState";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

import { commitTitle } from "../lib/title";
import { useCommitDialogStore } from "../store/dialog";
import { CommitPanel } from "./CommitPanel";

/** The diff of the file chosen in the dialog's lists. */
function ChosenDiff({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  const path = useSelectedFile(repoPath);
  if (selection?.kind === "commit" || selection === undefined || path === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Choose a changed or staged file to see its diff."
        className="h-full"
      />
    );
  }
  return <WorkingTreeDiff repoId={repoId} kind={selection.kind} path={path} />;
}

function DialogBody({ summary, repoPath }: { summary: RepoSummary; repoPath: string }) {
  const close = (output: string): void => {
    useCommitDialogStore.getState().setOpen(false);
    toast.success("Committed", { description: output.split("\n")[0] });
  };
  return (
    <>
      <div className="flex items-baseline gap-2 border-b border-border px-4 py-2 pr-12">
        <DialogTitle className="text-base">{commitTitle(summary.head)}</DialogTitle>
        <DialogDescription className="truncate">{summary.path}</DialogDescription>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(18rem,26rem)_1fr]">
        <div className="min-h-0 border-r border-border">
          <CommitPanel
            repoId={summary.id}
            repoPath={repoPath}
            showDiff={false}
            onCommitted={close}
          />
        </div>
        <div className="min-h-0 min-w-0">
          <ChosenDiff repoId={summary.id} repoPath={repoPath} />
        </div>
      </div>
    </>
  );
}

/**
 * The commit dialog: the same lists and message as the Commit module, with the chosen file's
 * diff beside them. Modal: the app behind it waits until it closes (Esc). Closes after a commit.
 */
export function CommitDialog() {
  const open = useCommitDialogStore((state) => state.open);
  const setOpen = useCommitDialogStore((state) => state.setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[85vh] max-w-[min(80rem,95vw)] flex-col gap-0 overflow-hidden p-0">
        <WithActiveRepository>
          {(summary, tab) => <DialogBody summary={summary} repoPath={tab.path} />}
        </WithActiveRepository>
      </DialogContent>
    </Dialog>
  );
}
