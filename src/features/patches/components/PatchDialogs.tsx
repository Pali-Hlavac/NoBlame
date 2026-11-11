import { closePatchDialog, usePatchDialogStore } from "../store/dialog";
import { ApplyPatchesDialog } from "./ApplyPatchesDialog";
import { ArchiveDialog } from "./ArchiveDialog";
import { CreatePatchDialog } from "./CreatePatchDialog";

/** The patch or archive dialog asked for; mounted once in the main window. */
export function PatchDialogs() {
  const request = usePatchDialogStore((state) => state.request);
  if (!request) return null;
  const { repoId } = request;
  switch (request.kind) {
    case "create":
      return (
        <CreatePatchDialog
          key={`${String(repoId)}:${request.commit.revision}`}
          repoId={repoId}
          commit={request.commit}
          onClose={closePatchDialog}
        />
      );
    case "apply":
      return <ApplyPatchesDialog key={repoId} repoId={repoId} onClose={closePatchDialog} />;
    case "archive":
      return (
        <ArchiveDialog
          key={`${String(repoId)}:${request.commit.revision}`}
          path={request.path}
          commit={request.commit}
          name={request.name}
          onClose={closePatchDialog}
        />
      );
  }
}
