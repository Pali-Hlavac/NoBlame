import { ArchiveIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { statusScope, useWorkingTreeStatus } from "@/features/working-tree";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import { actionDone } from "@/shared/lib/actionDone";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useStashChanges } from "../api/stashes";
import { listsComplete, stashRequest, stashableFiles } from "../lib/push";
import { CheckedFiles } from "./CheckedFiles";

interface StashDialogProps {
  repoId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHECKBOX_CLASS =
  "size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** "Stash changes": a message, the files to stash (all by default) and git's two options. */
export function StashDialog({ repoId, open, onOpenChange }: StashDialogProps) {
  const id = useId();
  const status = useWorkingTreeStatus(repoId, open).data;
  const stash = useStashChanges(repoId);
  const [message, setMessage] = useState("");
  const [keepIndex, setKeepIndex] = useState(false);
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);

  const files = status ? stashableFiles(status, includeUntracked) : [];
  // A task window lists one folder's changes: then only the chosen paths are stashed.
  const scope = statusScope();
  const everythingListed = status ? scope === null && listsComplete(status) : false;
  const chosen = files.filter((file) => !excluded.includes(file.path)).length;

  const close = (): void => {
    stash.reset();
    setMessage("");
    setExcluded([]);
    onOpenChange(false);
  };
  const submit = (): void => {
    const form = { message, keepIndex, includeUntracked };
    stash.mutate(stashRequest(form, files, excluded, everythingListed), {
      onSuccess: (output) => {
        toast.success("Stashed", { description: output.split("\n")[0] });
        actionDone("stash");
        close();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="flex h-[min(36rem,85vh)] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Stash changes</DialogTitle>
          <DialogDescription>
            The chosen changes are saved as a stash and taken out of the working tree.
            {scope === null ? null : ` Only the changes in ${scope} are listed.`}
          </DialogDescription>
        </DialogHeader>
        <label htmlFor={`${id}-message`} className="sr-only">
          Stash message
        </label>
        <input
          id={`${id}-message`}
          value={message}
          placeholder="Message (optional)"
          className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex-1">
            {chosen.toLocaleString()} of {files.length.toLocaleString()} files chosen
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            disabled={files.length === 0}
            onClick={() => {
              setExcluded(chosen === files.length ? files.map((file) => file.path) : []);
            }}
          >
            {chosen === files.length ? "Choose none" : "Choose all"}
          </Button>
        </div>
        <div className="min-h-0 flex-1 rounded-md border border-border">
          {status ? (
            files.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No changes to stash.</p>
            ) : (
              <CheckedFiles
                className="h-full"
                label="Files to stash"
                files={files}
                keyOf={(file) => file.path}
                checked={files.map((file) => file.path).filter((p) => !excluded.includes(p))}
                onCheck={(keys, check) => {
                  setExcluded((now) =>
                    check ? now.filter((key) => !keys.includes(key)) : [...now, ...keys],
                  );
                }}
              />
            )
          ) : (
            <LoadingState label="Reading the changes…" className="h-full" />
          )}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={includeUntracked}
            onChange={(event) => {
              setIncludeUntracked(event.target.checked);
            }}
          />
          Include new files (they are taken out too)
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={keepIndex}
            onChange={(event) => {
              setKeepIndex(event.target.checked);
            }}
          />
          Keep staged changes in place too
        </label>
        {stash.error ? <InlineError error={stash.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={stash.isPending || chosen === 0} onClick={submit}>
            <ArchiveIcon aria-hidden />
            {stash.isPending ? "Stashing…" : "Stash"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
