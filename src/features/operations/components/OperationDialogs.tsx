import { closeOperationDialog, useOperationDialogStore } from "../store/dialog";
import { ConflictsDialog } from "./ConflictsDialog";
import { InteractiveDialog } from "./InteractiveDialog";
import { MergeDialog } from "./MergeDialog";
import { PickDialog } from "./PickDialog";
import { RebaseDialog } from "./RebaseDialog";
import { ResetDialog } from "./ResetDialog";

/**
 * The history-changing dialog asked for (`openMerge`, `openPick`, `openRebase`, `openReset`,
 * `openInteractive`, `openConflicts`);
 * mounted once in the main window.
 */
export function OperationDialogs() {
  const request = useOperationDialogStore((state) => state.request);
  if (!request) return null;
  const { repoId } = request;
  switch (request.kind) {
    case "merge":
      return (
        <MergeDialog
          key={`${String(repoId)}:${request.source.revision}`}
          repoId={repoId}
          source={request.source}
          onClose={closeOperationDialog}
        />
      );
    case "cherryPick":
    case "revert":
      return (
        <PickDialog
          key={`${String(repoId)}:${request.kind}:${request.commit.revision}`}
          repoId={repoId}
          kind={request.kind}
          commit={request.commit}
          onClose={closeOperationDialog}
        />
      );
    case "rebase":
      return (
        <RebaseDialog
          key={`${String(repoId)}:${request.onto.revision}`}
          repoId={repoId}
          onto={request.onto}
          onClose={closeOperationDialog}
        />
      );
    case "interactive":
      return (
        <InteractiveDialog
          key={`${String(repoId)}:${request.from.revision}`}
          repoId={repoId}
          from={request.from}
          onClose={closeOperationDialog}
        />
      );
    case "conflicts":
      return <ConflictsDialog repoId={repoId} onClose={closeOperationDialog} />;
    case "reset":
      return (
        <ResetDialog
          key={`${String(repoId)}:${request.commit.revision}`}
          repoId={repoId}
          commit={request.commit}
          onClose={closeOperationDialog}
        />
      );
  }
}
