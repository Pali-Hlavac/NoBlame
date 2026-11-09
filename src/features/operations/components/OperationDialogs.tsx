import { closeOperationDialog, useOperationDialogStore } from "../store/dialog";
import { MergeDialog } from "./MergeDialog";

/** The history-changing dialog asked for (`openMerge`); mounted once in the main window. */
export function OperationDialogs() {
  const request = useOperationDialogStore((state) => state.request);
  if (!request) return null;
  return (
    <MergeDialog
      key={`${String(request.repoId)}:${request.source.revision}`}
      repoId={request.repoId}
      source={request.source}
      onClose={closeOperationDialog}
    />
  );
}
