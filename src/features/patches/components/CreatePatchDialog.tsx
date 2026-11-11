import { useId, useState } from "react";
import { toast } from "sonner";

import type { PickSource } from "@/features/graph";
import { Choice } from "@/shared/components/Choice";
import { InlineError } from "@/shared/components/InlineError";
import type { PatchOutputDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { usePatchCount, useSavePatches } from "../api/patches";
import { useDebounced } from "../hooks/useDebounced";
import { countText, patchFileName } from "../lib/patches";

const FIELD =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Typing a base asks git once it paused this long. */
const COUNT_DELAY_MS = 300;

/** Length of the short id in proposed file names. */
const SHORT_ID = 8;

interface CreatePatchDialogProps {
  repoId: number;
  commit: PickSource;
  onClose: () => void;
}

/**
 * Patches of a commit, or of the commits after a base up to it: how many (merges are left
 * out), into one file or one file per commit in a folder. The app then asks where.
 */
export function CreatePatchDialog({ repoId, commit, onClose }: CreatePatchDialogProps) {
  const id = useId();
  const merge = commit.parentCount > 1;
  const [range, setRange] = useState(merge);
  const [base, setBase] = useState("");
  const [output, setOutput] = useState<PatchOutputDto>("file");
  const settledBase = useDebounced(base.trim(), COUNT_DELAY_MS);
  const commits = { tip: commit.revision, base: range ? settledBase || null : null };
  const ready = !range || settledBase.length > 0;
  const count = usePatchCount(repoId, commits, ready);
  const save = useSavePatches(repoId);
  const known = ready && !count.isPlaceholderData ? count.data : undefined;
  const several = range;
  const summary = commit.label.slice(commit.label.indexOf(" ") + 1);

  const submit = () => {
    save.mutate(
      {
        commits,
        output: several ? output : "file",
        fileName: patchFileName(commit.revision.slice(0, SHORT_ID), summary, commits.base),
      },
      {
        onSuccess: (saved) => {
          if (!saved) return;
          const what =
            saved.commits === 1 ? "the patch" : `${saved.commits.toLocaleString()} patches`;
          toast.success(`Saved ${what}`, { description: saved.path });
          onClose();
        },
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
            <DialogTitle>Create patches</DialogTitle>
            <DialogDescription>
              A patch holds a commit&apos;s changes and message, to send or keep. Git applies it
              with git am, NoBlame with Apply patches in the Commit button&apos;s menu.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">Commits</legend>
            <Choice
              id={`${id}-one`}
              type="radio"
              name={`${id}-range`}
              checked={!range}
              disabled={merge}
              onChange={() => {
                setRange(false);
              }}
              label={<span className="break-words">Only {commit.label}</span>}
              detail={
                merge ? "A merge commit has no patch of its own: git leaves merges out." : undefined
              }
            />
            <Choice
              id={`${id}-range`}
              type="radio"
              name={`${id}-range`}
              checked={range}
              onChange={() => {
                setRange(true);
              }}
              label="The commits after a branch, tag or commit, up to this one"
            />
            {range ? (
              <input
                aria-label="After this branch, tag or commit"
                value={base}
                placeholder="origin/main"
                spellCheck={false}
                autoComplete="off"
                className={`${FIELD} ml-6`}
                onChange={(event) => {
                  setBase(event.target.value);
                }}
              />
            ) : null}
          </fieldset>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!ready
              ? "Name where the patches start: they hold the commits after it."
              : count.isFetching && !known
                ? "Counting the commits…"
                : known
                  ? countText(known)
                  : null}
          </p>
          {ready && count.error && !count.isFetching ? <InlineError error={count.error} /> : null}
          {several ? (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">Save as</legend>
              <Choice
                id={`${id}-file`}
                type="radio"
                name={`${id}-output`}
                checked={output === "file"}
                onChange={() => {
                  setOutput("file");
                }}
                label="One file holding them all"
                detail="git am applies it in one go."
              />
              <Choice
                id={`${id}-folder`}
                type="radio"
                name={`${id}-output`}
                checked={output === "folder"}
                onChange={() => {
                  setOutput("folder");
                }}
                label="One file per commit, in a folder"
                detail="Named 0001-Subject.patch, 0002-…; files already in the folder are never replaced."
              />
            </fieldset>
          ) : null}
          {save.error ? <InlineError error={save.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !known || known.commits === 0}>
              {save.isPending ? "Saving…" : "Save…"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
