import { useMemo } from "react";

import { useRefActions } from "@/features/branches";
import { headNameOf, useRefs, useUpstreamList } from "@/features/graph";
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

import { pickRef, type PickedRef } from "./pickRef";
import { choosableRefs, operationInTheWay, upstreamValue } from "./refChoices";
import { RefList } from "./RefList";
import { closeRefPick as close, useRefPickStore, type RefPickTask } from "./refPick";

const WORDS: Record<RefPickTask, { title: (head: string) => string; description: string }> = {
  switch: {
    title: () => "Switch to",
    description:
      "Choose the branch to work on. A remote branch gets a local branch that follows it; a tag or a commit is checked out without a branch.",
  },
  merge: {
    title: (head) => `Merge into ${head}`,
    description: "Choose what to merge. Next you choose how.",
  },
  rebase: {
    title: (head) => `Rebase ${head} onto`,
    description: "Choose what to replay the branch's own commits on. Next you see which commits.",
  },
};

/**
 * The Switch, Merge and Rebase windows' question: which branch, remote branch or tag (or a
 * revision typed in). Choosing one hands it to the same action as the graph's menu.
 */
export function RefPickDialog({ repoId }: { repoId: number }) {
  const task = useRefPickStore((state) => state.open);
  if (task === null) return null;
  return <RefPick key={task} task={task} repoId={repoId} />;
}

function RefPick({ task, repoId }: { task: RefPickTask; repoId: number }) {
  const refs = useRefs(repoId);
  const upstreams = useUpstreamList(repoId);
  const actions = useRefActions(repoId);
  const operation = useWorkingTreeStatus(repoId).data?.operation?.kind;
  const head = headNameOf(refs.data) ?? "the current branch";
  const upstream = upstreamValue(upstreams.data?.find((entry) => entry.branch === head)?.upstream);
  const choosable = useMemo(() => choosableRefs(refs.data ?? []), [refs.data]);
  const blocked = operationInTheWay(operation);
  const words = WORDS[task];

  const choose = (picked: PickedRef): void => {
    if (blocked) return;
    close();
    pickRef(task, actions, picked);
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">{words.title(head)}</DialogTitle>
          <DialogDescription>{words.description}</DialogDescription>
        </DialogHeader>
        {blocked ? <p className="text-sm text-warning">{blocked}</p> : null}
        {refs.error ? (
          <InlineError error={refs.error} />
        ) : refs.data && !upstreams.isPending ? (
          <RefList
            label={words.title(head)}
            refs={choosable}
            upstream={upstream}
            // Merging or rebasing usually takes the upstream: it starts chosen.
            initial={task === "switch" ? undefined : upstream}
            disabled={blocked !== null}
            onChoose={choose}
          />
        ) : (
          <LoadingState label="Reading branches…" className="h-24" />
        )}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">Enter or a click chooses.</span>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
