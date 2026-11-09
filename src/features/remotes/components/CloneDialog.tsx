import { useId, useState } from "react";

import { afterJob, startClone, trackJob } from "@/features/jobs";
import { openRepositories, pickFolder, useRecentRepositories } from "@/features/repositories";
import { InlineError } from "@/shared/components/InlineError";
import type { CloneFilterDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import {
  DEFAULT_CLONE_OPTIONS,
  depthOf,
  folderNameOf,
  folderNameProblem,
  joinPath,
  parentOf,
  type CloneChoices,
} from "../lib/clone";
import { CloneOptions } from "./CloneOptions";
import { FIELD } from "./form";

/** “Clone repository”: waits for the recent list, whose newest entry suggests the folder. */
export function CloneDialog({ onClose }: { onClose: () => void }) {
  const recent = useRecentRepositories();
  if (recent.isPending) return null;
  const newest = recent.data?.[0]?.path;
  return <CloneForm initialParent={newest ? parentOf(newest) : ""} onClose={onClose} />;
}

function CloneForm({ initialParent, onClose }: { initialParent: string; onClose: () => void }) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [parent, setParent] = useState(initialParent);
  // Follows the URL until the user writes a name of their own.
  const [ownName, setOwnName] = useState<string | null>(null);
  const [choices, setChoices] = useState<CloneChoices>(DEFAULT_CLONE_OPTIONS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const name = ownName ?? folderNameOf(url);
  const folder = parent.trim() && name.trim() ? joinPath(parent.trim(), name.trim()) : null;
  const problem =
    url.trim() === ""
      ? "Enter the repository's URL."
      : parent.trim() === ""
        ? "Choose the folder to clone into."
        : (folderNameProblem(name) ??
          (choices.shallow && depthOf(choices.depth) === null
            ? "Enter how many of the newest commits to download (1 or more)."
            : null));

  const submit = () => {
    if (problem !== null || folder === null) return;
    setPending(true);
    setError(null);
    trackJob(
      startClone({
        url: url.trim(),
        folder,
        branch: choices.branch.trim() || null,
        depth: choices.shallow ? depthOf(choices.depth) : null,
        singleBranch: choices.singleBranch,
        filter: choices.filter satisfies CloneFilterDto,
        recurseSubmodules: choices.submodules,
      }),
      "clone",
    ).then(
      (job) => {
        if (choices.open) {
          afterJob(job, (ended) => {
            if (ended.state === "succeeded") openRepositories([ended.repoPath]);
          });
        }
        onClose();
      },
      (reason: unknown) => {
        setError(reason);
        setPending(false);
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Clone repository</DialogTitle>
            <DialogDescription>
              Copies a repository to this computer. It runs in the background; the jobs list in the
              status bar shows how far it got.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
            <label htmlFor={`${id}-url`} className="text-sm font-medium">
              URL
            </label>
            <input
              id={`${id}-url`}
              value={url}
              placeholder="https://… or git@host:owner/repo.git"
              spellCheck={false}
              autoComplete="off"
              className={`${FIELD} font-mono`}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
            />
            <label htmlFor={`${id}-parent`} className="text-sm font-medium">
              Into
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id={`${id}-parent`}
                value={parent}
                placeholder="The folder that will hold it"
                spellCheck={false}
                autoComplete="off"
                className={`${FIELD} flex-1 font-mono`}
                onChange={(event) => {
                  setParent(event.target.value);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void pickFolder("Clone into…").then((picked) => {
                    if (picked) setParent(picked);
                  });
                }}
              >
                Browse…
              </Button>
            </div>
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              Folder name
            </label>
            <input
              id={`${id}-name`}
              value={name}
              spellCheck={false}
              autoComplete="off"
              className={`${FIELD} font-mono`}
              onChange={(event) => {
                setOwnName(event.target.value);
              }}
            />
          </div>
          {folder && !problem && (
            <p className="text-xs break-all text-muted-foreground">Clones into {folder}</p>
          )}
          <CloneOptions choices={choices} onChange={setChoices} />
          {problem && url !== "" && <p className="text-xs text-destructive">{problem}</p>}
          {error ? <InlineError error={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={problem !== null || pending}>
              {pending ? "Starting…" : "Clone"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
