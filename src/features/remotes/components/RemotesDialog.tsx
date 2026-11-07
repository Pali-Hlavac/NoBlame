import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { startFetch, startJob } from "@/features/jobs";
import { repositoryName, useRepositoryPath } from "@/features/repositories";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { RemoteDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useRemoteDetails } from "../api/remotes";
import { branchCount, namedList } from "../lib/remotes";
import { RemoteForm } from "./RemoteForm";
import { RemoveRemoteDialog } from "./RemoveRemoteDialog";

type View = { kind: "list" } | { kind: "add" } | { kind: "edit"; remote: RemoteDto };

interface RemotesDialogProps {
  repoId: number;
  /** Opens with the form to add a remote. */
  adding?: boolean;
  onClose: () => void;
}

/** “Remotes”: where the repository fetches from and pushes to; add, edit, remove, fetch. */
export function RemotesDialog({ repoId, adding = false, onClose }: RemotesDialogProps) {
  const remotes = useRemoteDetails(repoId);
  const path = useRepositoryPath(repoId);
  const [view, setView] = useState<View>(adding ? { kind: "add" } : { kind: "list" });
  const [removing, setRemoving] = useState<RemoteDto | null>(null);
  const names = (remotes.data ?? []).map((remote) => remote.name);
  const where = path === undefined ? "the repository" : repositoryName(path);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {view.kind === "add"
              ? "Add a remote"
              : view.kind === "edit"
                ? `Edit ${view.remote.name}`
                : `Remotes of ${where}`}
          </DialogTitle>
          <DialogDescription>
            Remotes are the other copies of {where} that you fetch from, pull from and push to.
          </DialogDescription>
        </DialogHeader>
        {view.kind !== "list" ? (
          <RemoteForm
            key={view.kind === "edit" ? view.remote.name : "add"}
            repoId={repoId}
            remote={view.kind === "edit" ? view.remote : undefined}
            taken={names}
            onDone={() => {
              setView({ kind: "list" });
            }}
          />
        ) : remotes.error ? (
          <ErrorState
            error={remotes.error}
            title="Could not read the remotes"
            onRetry={() => void remotes.refetch()}
          />
        ) : !remotes.data ? (
          <LoadingState label="Reading remotes…" />
        ) : (
          <>
            {remotes.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No remotes yet. Add one to fetch, pull and push.
              </p>
            ) : (
              <ul aria-label="Remotes" className="flex max-h-80 flex-col gap-2 overflow-auto">
                {remotes.data.map((remote) => (
                  <RemoteItem
                    key={remote.name}
                    remote={remote}
                    onFetch={
                      path === undefined
                        ? undefined
                        : () => {
                            startJob(
                              startFetch({
                                path,
                                target: { type: "remote", name: remote.name },
                                prune: false,
                              }),
                              "fetch",
                            );
                          }
                    }
                    onEdit={() => {
                      setView({ kind: "edit", remote });
                    }}
                    onRemove={() => {
                      setRemoving(remote);
                    }}
                  />
                ))}
              </ul>
            )}
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setView({ kind: "add" });
                }}
              >
                <PlusIcon aria-hidden />
                Add remote…
              </Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        )}
        {removing && (
          <RemoveRemoteDialog
            repoId={repoId}
            remote={removing}
            onClose={() => {
              setRemoving(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RemoteItemProps {
  remote: RemoteDto;
  onFetch: (() => void) | undefined;
  onEdit: () => void;
  onRemove: () => void;
}

function RemoteItem({ remote, onFetch, onEdit, onRemove }: RemoteItemProps) {
  const facts = [
    branchCount(remote.branches),
    remote.trackedBy.length > 0 && `tracked by ${namedList(remote.trackedBy)}`,
    remote.extraUrls > 0 &&
      `${String(remote.extraUrls)} more URL${remote.extraUrls === 1 ? "" : "s"} (edit those in a terminal)`,
  ].filter(Boolean);
  const action = "size-7 text-muted-foreground hover:text-foreground";
  return (
    <li className="flex items-start gap-2 rounded-md border border-border p-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{remote.name}</p>
        <p className="truncate font-mono text-xs" title={remote.shownUrl ?? undefined}>
          {remote.shownUrl ?? "(no URL)"}
        </p>
        {remote.shownPushUrl && (
          <p className="truncate font-mono text-xs" title={remote.shownPushUrl}>
            <span className="font-sans text-muted-foreground">Push: </span>
            {remote.shownPushUrl}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{facts.join(" · ")}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={action}
        aria-label={`Fetch ${remote.name}`}
        title={`Fetch ${remote.name}`}
        disabled={!onFetch}
        onClick={onFetch}
      >
        <RefreshCwIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={action}
        aria-label={`Edit ${remote.name}`}
        title="Edit: name and URLs"
        onClick={onEdit}
      >
        <PencilIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={action}
        aria-label={`Remove ${remote.name}`}
        title="Remove…"
        onClick={onRemove}
      >
        <Trash2Icon aria-hidden />
      </Button>
    </li>
  );
}
