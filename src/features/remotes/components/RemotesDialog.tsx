import { useCallback, useState } from "react";

import { startFetch, startJob } from "@/features/jobs";
import { repositoryName, useRepositoryPath } from "@/features/repositories";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useRemoteDetails } from "../api/remotes";
import { RemoteEditor } from "./editor/RemoteEditor";
import { RemoteForm } from "./RemoteForm";
import { RemoteList } from "./RemoteList";
import { RemoveRemoteDialog } from "./RemoveRemoteDialog";

/** The right side: a remote's editor, or the form adding one. */
type Pane = { kind: "remote"; name: string } | { kind: "add" };

interface RemotesDialogProps {
  repoId: number;
  /** Opens with the form to add a remote. */
  adding?: boolean;
  onClose: () => void;
}

/** “Remotes”: the remotes on the left, the chosen one's settings on the right. */
export function RemotesDialog({ repoId, adding = false, onClose }: RemotesDialogProps) {
  const remotes = useRemoteDetails(repoId);
  const path = useRepositoryPath(repoId);
  const [chosen, setChosen] = useState<Pane | null>(adding ? { kind: "add" } : null);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState<(() => void) | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const list = remotes.data ?? [];
  const names = list.map((remote) => remote.name);
  const where = path === undefined ? "the repository" : repositoryName(path);
  // A removed or renamed remote falls back to the first one; none: the form to add one.
  const pane: Pane =
    chosen?.kind === "add" || (chosen && names.includes(chosen.name))
      ? chosen
      : list[0]
        ? { kind: "remote", name: list[0].name }
        : { kind: "add" };

  /** Runs `action`, asking first when the editor has unsaved changes. */
  const leave = (action: () => void) => {
    if (dirty) setDiscarding(() => action);
    else action();
  };
  const onDirtyChange = useCallback((value: boolean) => {
    setDirty(value);
  }, []);
  const removed = list.find((remote) => remote.name === removing);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) leave(onClose);
      }}
    >
      <DialogContent
        className="flex h-[min(44rem,85vh)] max-w-5xl flex-col"
        onEscapeKeyDown={(event) => {
          // Esc in a search box with text clears it (its own handler); the next one closes.
          const target = event.target;
          if (target instanceof HTMLInputElement && target.type === "search" && target.value) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Remotes of {where}</DialogTitle>
          <DialogDescription>
            Remotes are the other copies of {where} that you fetch from, pull from and push to.
          </DialogDescription>
        </DialogHeader>
        {remotes.error ? (
          <ErrorState
            error={remotes.error}
            title="Could not read the remotes"
            onRetry={() => void remotes.refetch()}
          />
        ) : !remotes.data ? (
          <LoadingState label="Reading remotes…" />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr] gap-4">
            <RemoteList
              remotes={list}
              selected={pane.kind === "remote" ? pane.name : null}
              onSelect={(name) => {
                if (pane.kind !== "remote" || pane.name !== name) {
                  leave(() => {
                    setChosen({ kind: "remote", name });
                  });
                }
              }}
              onAdd={() => {
                leave(() => {
                  setChosen({ kind: "add" });
                });
              }}
              onFetch={
                path === undefined
                  ? undefined
                  : (name) => {
                      startJob(
                        startFetch({ path, target: { type: "remote", name }, prune: false }),
                        "fetch",
                      );
                    }
              }
            />
            <div className="flex min-h-0 min-w-0 flex-col">
              {pane.kind === "add" ? (
                <RemoteForm
                  repoId={repoId}
                  taken={names}
                  onAdded={(name) => {
                    setChosen({ kind: "remote", name });
                  }}
                  onCancel={
                    list.length > 0
                      ? () => {
                          setChosen(null);
                        }
                      : undefined
                  }
                />
              ) : (
                <RemoteEditor
                  key={pane.name}
                  repoId={repoId}
                  name={pane.name}
                  otherRemotes={names.filter((name) => name !== pane.name)}
                  onDirtyChange={onDirtyChange}
                  onRenamed={(name) => {
                    setChosen({ kind: "remote", name });
                  }}
                  onRemove={() => {
                    setRemoving(pane.name);
                  }}
                />
              )}
            </div>
          </div>
        )}
        {removed && (
          <RemoveRemoteDialog
            repoId={repoId}
            remote={removed}
            onClose={() => {
              setRemoving(null);
            }}
          />
        )}
        <ConfirmDialog
          open={discarding !== null}
          onOpenChange={(open) => {
            if (!open) setDiscarding(null);
          }}
          title="Discard the unsaved changes?"
          description="The changes in the editor have not been saved. Discarding them leaves the remote's settings as they are."
          confirmLabel="Discard changes"
          destructive
          onConfirm={() => {
            const action = discarding;
            setDiscarding(null);
            setDirty(false);
            action?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
