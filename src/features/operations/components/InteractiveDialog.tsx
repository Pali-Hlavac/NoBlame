import { useId, useState } from "react";

import type { StartPoint } from "@/features/graph";
import { useWorkingTreeStatus } from "@/features/working-tree";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useInteractivePlan, useRebaseInteractive } from "../api/interactive";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { showOutcome } from "../lib/outcome";
import { interactiveToast } from "../lib/rebase";
import {
  type TodoMessages,
  type TodoRow,
  autosquash,
  buildSteps,
  changesAnything,
  hasAutosquash,
  problem,
} from "../lib/todo";
import { Choice } from "./Choice";
import { TodoList } from "./TodoList";

interface InteractiveDialogProps {
  repoId: number;
  /** The oldest commit to edit. */
  from: StartPoint;
  onClose: () => void;
}

/**
 * The interactive rebase editor: the commits from `from` up to HEAD, oldest first, to reorder,
 * reword, edit, squash, fix up or drop. Stopping (an edit, conflicts) closes it: the bar above
 * the commits takes over.
 */
export function InteractiveDialog({ repoId, from, onClose }: InteractiveDialogProps) {
  const id = useId();
  const plan = useInteractivePlan(repoId, from.revision);
  const run = useRebaseInteractive(repoId);
  const target = useCurrentBranch(repoId);
  const summary = useWorkingTreeStatus(repoId).data?.summary;
  const changed = summary ? summary.staged + summary.unstaged > 0 : false;
  const [autostashChoice, setAutostash] = useState<boolean | null>(null);
  const autostash = autostashChoice ?? changed;
  const [edited, setRows] = useState<TodoRow[] | null>(null);
  const [messages, setMessages] = useState<TodoMessages>({});

  const commits = plan.data?.commits ?? [];
  const rows = edited ?? commits.map((commit) => ({ commit, action: "pick" as const }));
  const issue = rows.length > 0 ? problem(rows) : null;
  const changes = changesAnything(rows, commits);
  const published = plan.data?.published ?? 0;
  const merges = plan.data?.merges ?? 0;

  const submit = () => {
    run.mutate(
      { from: from.revision, steps: buildSteps(rows, messages), autostash },
      {
        onSuccess: (result) => {
          showOutcome(interactiveToast(result, target, published > 0));
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
      <DialogContent className="max-w-3xl">
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="break-words">Edit the commits of {target}</DialogTitle>
            <DialogDescription>
              From {from.label} up to the newest, oldest first. Git replays them from the top in
              this order, and each gets a new id. Move a row with its arrows, or with Alt+Up and
              Alt+Down in its list.
            </DialogDescription>
          </DialogHeader>
          {plan.isPending ? <LoadingState label="Reading the commits…" /> : null}
          {plan.error ? <InlineError error={plan.error} /> : null}
          {rows.length > 0 ? (
            <TodoList
              rows={rows}
              messages={messages}
              onRows={setRows}
              onMessage={(commit, message) => {
                setMessages((current) => ({ ...current, [commit]: message }));
              }}
            />
          ) : null}
          {published > 0 ? (
            <p className="text-sm text-destructive">
              {published === rows.length ? "All" : String(published)} of these commits were pushed
              already. After the rebase, push {target} with force (with lease); anyone who built on
              them has to rebase too.
            </p>
          ) : null}
          {merges > 0 ? (
            <p className="text-sm text-muted-foreground">
              {merges === 1 ? "1 merge commit is" : `${String(merges)} merge commits are`} in this
              range: left out, their commits come in one line.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Choice
              id={`${id}-autostash`}
              type="checkbox"
              checked={autostash}
              onChange={setAutostash}
              label="Stash my uncommitted changes meanwhile"
              detail={
                changed
                  ? "You have uncommitted changes; without this git refuses to rebase (--autostash)."
                  : "They come back after the rebase (--autostash)."
              }
            />
          </div>
          {issue ? <p className="text-sm text-destructive">{issue}</p> : null}
          {run.error ? <InlineError error={run.error} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {hasAutosquash(rows) ? (
              <Button
                type="button"
                variant="outline"
                title="Move each fixup! and squash! commit under the commit it names (--autosquash)"
                onClick={() => {
                  setRows(autosquash(rows));
                }}
              >
                Arrange fixup! commits
              </Button>
            ) : null}
            {changes ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRows(null);
                  setMessages({});
                }}
              >
                Start over
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!changes || issue !== null || run.isPending}
              title={changes ? undefined : "Nothing changed yet"}
            >
              {run.isPending ? "Rebasing…" : "Rebase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
