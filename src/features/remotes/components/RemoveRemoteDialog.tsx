import { toast } from "sonner";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { RemoteDto } from "@/shared/ipc/bindings";

import { useRemoveRemote } from "../api/remotes";
import { branchCount, namedList } from "../lib/remotes";

interface RemoveRemoteDialogProps {
  repoId: number;
  remote: RemoteDto;
  onClose: () => void;
}

/** Removing a remote, naming what goes from this repository: its remote branches and upstreams. */
export function RemoveRemoteDialog({ repoId, remote, onClose }: RemoveRemoteDialogProps) {
  const remove = useRemoveRemote(repoId);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Remove the remote ${remote.name}?`}
      description={
        <>
          {remote.branches > 0
            ? `Its ${branchCount(remote.branches)} go from this repository. `
            : "It has no remote branches here. "}
          {remote.trackedBy.length > 0 &&
            `${namedList(remote.trackedBy)} will no longer track it (their upstream is removed). `}
          Nothing changes on the server; adding it again and fetching brings the branches back.
          {remote.shownUrl && (
            <span className="mt-2 block font-mono text-xs break-all">{remote.shownUrl}</span>
          )}
        </>
      }
      confirmLabel="Remove remote"
      destructive
      pending={remove.isPending}
      error={remove.error}
      onConfirm={() => {
        remove.mutate(remote.name, {
          onSuccess: () => {
            toast.success(`Removed the remote ${remote.name}`);
            onClose();
          },
        });
      }}
    />
  );
}
