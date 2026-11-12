import { useId, useState } from "react";

import { startJob, startPull } from "@/features/jobs";
import { Choice } from "@/shared/components/Choice";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { FETCHES, PULLS, fetchRepository } from "../workbench/remote";
import { closeRemoteTask as close, useRemoteTaskStore } from "./remoteTask";

interface RemoteTaskDialogProps {
  /** The repository's top folder: jobs need a path, not a session. */
  repoPath: string;
  /** The current branch, which a pull integrates into. */
  branch: string | undefined;
}

const WORDS = {
  pull: {
    title: (branch: string | undefined) => `Pull into ${branch ?? "the current branch"}`,
    description:
      "Fetches the branch's upstream and brings its commits into the branch. Uncommitted changes git would overwrite stop it before it starts.",
    legend: "How",
    action: "Pull",
  },
  fetch: {
    title: () => "Fetch",
    description:
      "Downloads new commits, branches and tags from the remotes. Your branches and files do not change.",
    legend: "Which",
    action: "Fetch",
  },
} as const;

/**
 * The Pull or Fetch window's question: how to pull, or from where to fetch. The job then runs
 * in the background; the Git output window shows its progress and what git printed (a task
 * window shows it for every job it starts).
 */
export function RemoteTaskDialog({ repoPath, branch }: RemoteTaskDialogProps) {
  const id = useId();
  const open = useRemoteTaskStore((state) => state.open);
  const [pull, setPull] = useState(0);
  const [fetch, setFetch] = useState(0);
  if (open === null) return null;
  const words = WORDS[open];
  const choices = open === "pull" ? PULLS : FETCHES;
  const chosen = open === "pull" ? pull : fetch;
  const choose = open === "pull" ? setPull : setFetch;

  const submit = (): void => {
    if (open === "pull") {
      const mode = PULLS[pull]?.value ?? "default";
      startJob(startPull({ path: repoPath, mode }), "pull");
    } else {
      const choice = FETCHES[fetch]?.value;
      if (choice) fetchRepository(repoPath, choice.target, choice.prune);
    }
    close();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="break-words">{words.title(branch)}</DialogTitle>
            <DialogDescription>{words.description}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">{words.legend}</legend>
            {choices.map((choice, index) => (
              <Choice
                key={choice.id}
                id={`${id}-${choice.id}`}
                type="radio"
                name={`${id}-${open}`}
                checked={chosen === index}
                onChange={() => {
                  choose(index);
                }}
                label={choice.label}
              />
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{words.action}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
