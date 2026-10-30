import { useState } from "react";

import { select } from "@/features/selection";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { NO_FILTER, useSetGraphFilter } from "../api/filter";
import { goToCommit } from "../api/find";
import { shortId } from "../lib/format";
import { useGraphViewStore } from "../store/graphView";

type Problem =
  | { kind: "error"; message: string; hint: string | null }
  | { kind: "hidden"; id: string }
  | { kind: "notInGraph"; id: string };

/**
 * "Go to commit" (Ctrl+Shift+G): selects the commit a revision names — a full or short id, a
 * branch or tag, `HEAD~2`. A commit the filter hides can be shown by clearing the filter.
 */
export function GoToCommitDialog({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const open = useGraphViewStore((state) => state.goToOpen === repoPath);
  const [revision, setRevision] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const setFilter = useSetGraphFilter(repoId, repoPath);

  const close = () => {
    useGraphViewStore.getState().setGoToOpen(null);
    setProblem(null);
  };

  const go = async (clearFilter: boolean) => {
    setPending(true);
    try {
      if (clearFilter) await setFilter.mutateAsync(NO_FILTER);
      const found = await goToCommit(repoId, revision);
      if (found.row !== null) {
        select(repoPath, { kind: "commit", row: found.row });
        close();
      } else {
        setProblem({
          kind: found.status === "hiddenByFilter" ? "hidden" : "notInGraph",
          id: found.id,
        });
      }
    } catch (error) {
      const { message, hint } = toIpcError(error);
      setProblem({ kind: "error", message, hint });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Go to commit</DialogTitle>
          <DialogDescription>
            A commit id (at least 4 characters), a branch or tag name, or an expression such as
            HEAD~2.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (revision.trim() !== "") void go(false);
          }}
        >
          <input
            // The dialog exists to type into this field.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label="Commit id, branch, tag or expression"
            value={revision}
            spellCheck={false}
            className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => {
              setRevision(event.target.value);
              setProblem(null);
            }}
          />
          {problem && (
            <div role="alert" className="space-y-2 text-sm">
              {problem.kind === "error" && (
                <>
                  <p className="text-destructive">{problem.message}</p>
                  {problem.hint && <p className="text-muted-foreground">{problem.hint}</p>}
                </>
              )}
              {problem.kind === "hidden" && (
                <>
                  <p>The filter hides commit {shortId(problem.id)}.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void go(true)}
                  >
                    Show all commits and go there
                  </Button>
                </>
              )}
              {problem.kind === "notInGraph" && (
                <p>
                  Commit {shortId(problem.id)} exists, but no branch, tag or HEAD leads to it (for
                  example a stash or a dropped commit), so the graph does not show it.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || revision.trim() === ""}>
              Go
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
