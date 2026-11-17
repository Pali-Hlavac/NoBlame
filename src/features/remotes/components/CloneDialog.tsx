import { afterJob } from "@/features/jobs";
import { openRepositories, useRecentRepositories } from "@/features/repositories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { parentOf } from "../lib/clone";
import { CloneForm } from "./CloneForm";

/** “Clone repository”: waits for the recent list, whose newest entry suggests the folder. */
export function CloneDialog({ onClose }: { onClose: () => void }) {
  const recent = useRecentRepositories();
  if (recent.isPending) return null;
  const newest = recent.data?.[0]?.path;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clone repository</DialogTitle>
          <DialogDescription>
            Copies a repository to this computer. It runs in the background; the jobs list in the
            status bar shows how far it got.
          </DialogDescription>
        </DialogHeader>
        <CloneForm
          initialParent={newest ? parentOf(newest) : ""}
          onCancel={onClose}
          onStarted={({ job, open }) => {
            if (open) {
              afterJob(job, (ended) => {
                if (ended.state === "succeeded") openRepositories([ended.repoPath]);
              });
            }
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
