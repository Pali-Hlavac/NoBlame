import { branchOfRemote } from "../lib/names";
import { closeBranchDialog, useBranchDialogStore } from "../store/dialog";
import { CheckoutCommitDialog } from "./CheckoutCommitDialog";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { CreateTagDialog } from "./CreateTagDialog";
import { DeleteRefDialog } from "./DeleteRefDialog";
import { RenameBranchDialog } from "./RenameBranchDialog";

/** Shows the branch or tag dialog asked for (mounted once, in the main window). */
export function BranchDialogs() {
  const request = useBranchDialogStore((state) => state.request);
  if (!request) return null;
  const { repoId } = request;
  // A new request replaces the dialog: the key starts it afresh.
  const key = JSON.stringify(request);
  switch (request.kind) {
    case "create-branch":
      return (
        <CreateBranchDialog
          key={key}
          repoId={repoId}
          start={request.start}
          onClose={closeBranchDialog}
        />
      );
    case "checkout-remote":
      return (
        <CreateBranchDialog
          key={key}
          repoId={repoId}
          remote
          start={{
            revision: `refs/remotes/${request.remote.name}`,
            label: request.remote.name,
          }}
          initialName={branchOfRemote(request.remote.name)}
          onClose={closeBranchDialog}
        />
      );
    case "create-tag":
      return (
        <CreateTagDialog
          key={key}
          repoId={repoId}
          target={request.start}
          onClose={closeBranchDialog}
        />
      );
    case "rename-branch":
      return (
        <RenameBranchDialog
          key={key}
          repoId={repoId}
          branch={request.branch}
          onClose={closeBranchDialog}
        />
      );
    case "delete":
      return (
        <DeleteRefDialog
          key={key}
          repoId={repoId}
          reference={request.reference}
          onClose={closeBranchDialog}
        />
      );
    case "checkout-commit":
      return (
        <CheckoutCommitDialog
          key={key}
          repoId={repoId}
          commit={request.commit}
          onClose={closeBranchDialog}
        />
      );
  }
}
