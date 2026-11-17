import { closeStashChanges, useStashDialogStore } from "../store/stashDialog";
import { StashDialog } from "./StashDialog";

/** "Stash changes" for the repository asked (`openStashChanges`); mounted once per window. */
export function StashChangesDialog() {
  const repoId = useStashDialogStore((state) => state.repoId);
  if (repoId === null) return null;
  return (
    <StashDialog
      key={repoId}
      repoId={repoId}
      open
      onOpenChange={(open) => {
        if (!open) closeStashChanges();
      }}
    />
  );
}
