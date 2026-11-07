import { closeRemoteDialog, useRemoteDialogStore } from "../store/dialog";
import { CloneDialog } from "./CloneDialog";
import { RemotesDialog } from "./RemotesDialog";

/** Shows the Remotes or Clone dialog asked for (mounted once, in the main window). */
export function RemoteDialogs() {
  const request = useRemoteDialogStore((state) => state.request);
  if (!request) return null;
  // A new request replaces the dialog: the key starts it afresh.
  const key = JSON.stringify(request);
  switch (request.kind) {
    case "remotes":
      return (
        <RemotesDialog
          key={key}
          repoId={request.repoId}
          adding={request.adding}
          onClose={closeRemoteDialog}
        />
      );
    case "clone":
      return <CloneDialog key={key} onClose={closeRemoteDialog} />;
  }
}
