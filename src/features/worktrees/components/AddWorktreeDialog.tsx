import { useId, useState } from "react";
import { toast } from "sonner";

import { newNameProblem } from "@/features/branches";
import { useRefs } from "@/features/graph";
import { openRepositories, pickFolder, useActiveRepository } from "@/features/repositories";
import { InlineError } from "@/shared/components/InlineError";
import type { WorktreeCheckoutDto, WorktreeDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useAddWorktree } from "../api/worktrees";
import { folderName, folderProblem, suggestedFolder } from "../lib/worktrees";
import { WorktreeCheckoutFields, type CheckoutChoice } from "./WorktreeCheckoutFields";

const FIELD =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface AddWorktreeDialogProps {
  repoId: number;
  worktrees: readonly WorktreeDto[];
  onClose: () => void;
}

/** The checkout git is asked for, or why the choice is not complete. */
function checkoutOf(choice: CheckoutChoice, branches: ReadonlySet<string>) {
  switch (choice.kind) {
    case "newBranch": {
      const problem = newNameProblem(choice.name.trim(), branches, "branch");
      return problem
        ? { problem }
        : {
            checkout: {
              kind: "newBranch",
              name: choice.name.trim(),
              start: choice.start.trim() || "HEAD",
            } satisfies WorktreeCheckoutDto,
          };
    }
    case "branch":
      return choice.name
        ? { checkout: { kind: "branch", name: choice.name } satisfies WorktreeCheckoutDto }
        : { problem: "Choose a branch." };
    case "detached":
      return {
        checkout: {
          kind: "detached",
          revision: choice.revision.trim() || "HEAD",
        } satisfies WorktreeCheckoutDto,
      };
  }
}

/** Adds a worktree: a folder, and the new branch, branch or commit it checks out. */
export function AddWorktreeDialog({ repoId, worktrees, onClose }: AddWorktreeDialogProps) {
  const id = useId();
  const add = useAddWorktree(repoId);
  const head = useActiveRepository().summary?.head;
  const refs = useRefs(repoId).data ?? [];
  const branches = new Set(
    refs.flatMap((entry) => (entry.label.kind === "branch" ? [entry.label.name] : [])),
  );
  // git refuses a branch checked out in another worktree.
  const used = new Set(worktrees.flatMap((worktree) => worktree.branch ?? []));
  const free = [...branches].filter((name) => !used.has(name)).sort();
  const [choice, setChoice] = useState<CheckoutChoice>({
    kind: "newBranch",
    name: "",
    start: head?.kind === "branch" ? head.name : "HEAD",
    revision: "HEAD",
  });
  const main = worktrees.find((worktree) => worktree.main)?.path ?? "";
  const [ownFolder, setOwnFolder] = useState<string | null>(null);
  const named = choice.kind === "detached" ? "detached" : choice.name;
  const folder = ownFolder ?? (main ? suggestedFolder(main, named) : "");
  const [open, setOpen] = useState(true);
  const result = checkoutOf(choice, branches);
  const problem = folderProblem(folder) ?? result.problem ?? null;

  const submit = () => {
    if (problem !== null || !result.checkout || add.isPending) return;
    add.mutate(
      { folder: folder.trim(), checkout: result.checkout },
      {
        onSuccess: () => {
          toast.success(`Added the worktree ${folderName(folder.trim())}`);
          if (open) openRepositories([folder.trim()]);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
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
            <DialogTitle>Add a worktree</DialogTitle>
            <DialogDescription>
              Checks out a branch in a folder of its own, sharing this repository's history and
              branches. Work on both at once; commit in either.
            </DialogDescription>
          </DialogHeader>
          <WorktreeCheckoutFields choice={choice} free={free} onChange={setChoice} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-folder`} className="text-sm font-medium">
              Folder
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id={`${id}-folder`}
                value={folder}
                spellCheck={false}
                autoComplete="off"
                className={`${FIELD} flex-1 font-mono`}
                onChange={(event) => {
                  setOwnFolder(event.target.value);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void pickFolder("Folder of the new worktree").then((picked) => {
                    if (picked) setOwnFolder(picked);
                  });
                }}
              >
                Browse…
              </Button>
            </div>
            {/* The field shows the start of a long path; the end is the part that differs. */}
            <p className="text-xs break-all text-muted-foreground">
              {folder.trim()
                ? `${folder.trim()}: a new folder, or an empty one.`
                : "A new folder, or an empty one."}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              checked={open}
              onChange={(event) => {
                setOpen(event.target.checked);
              }}
            />
            Open it when done
          </label>
          {problem !== null && (choice.kind !== "newBranch" || choice.name !== "") && (
            <p className="text-xs text-destructive">{problem}</p>
          )}
          {add.error ? <InlineError error={add.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={problem !== null || add.isPending}>
              {add.isPending ? "Adding…" : "Add worktree"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
