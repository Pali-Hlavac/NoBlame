import { CheckCircle2Icon } from "lucide-react";
import { useState } from "react";

import { afterJob } from "@/features/jobs";
import { CloneForm } from "@/features/remotes";
import { openInMainWindow } from "@/features/windows";
import { LoadingState } from "@/shared/components/LoadingState";
import type { JobDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { TaskDone } from "./TaskDone";

type CloneStage =
  | { kind: "form" }
  | { kind: "running"; folder: string }
  | { kind: "done"; folder: string }
  | { kind: "failed"; job: JobDto };

/**
 * The Clone window (`noblame clone <folder>`): the clone form with the folder given as the
 * one that will hold it, the job's progress (the Git output window shows git's output), then a
 * way to open the new repository.
 */
export function CloneTask({ path }: { path: string }) {
  const [stage, setStage] = useState<CloneStage>({ kind: "form" });
  const again = (): void => {
    setStage({ kind: "form" });
  };
  switch (stage.kind) {
    case "form":
      return (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Clone a repository</h2>
          <p className="text-sm text-muted-foreground">
            Copies a repository to this computer, into a new folder in the one below.
          </p>
          <CloneForm
            initialParent={path}
            onStarted={({ job, folder, open }) => {
              setStage({ kind: "running", folder });
              afterJob(job, (ended) => {
                if (ended.state !== "succeeded") {
                  setStage({ kind: "failed", job: ended });
                  return;
                }
                setStage({ kind: "done", folder: ended.repoPath });
                if (open) void openInMainWindow(ended.repoPath).catch(() => undefined);
              });
            }}
          />
        </div>
      );
    case "running":
      return (
        <LoadingState
          label={`Cloning into ${stage.folder}… Git's output shows in the output window.`}
          className="py-8"
        />
      );
    case "done":
      return (
        <TaskDone
          title="Cloned"
          folder={stage.folder}
          icon={CheckCircle2Icon}
          againLabel="Clone another"
          onAgain={again}
        />
      );
    case "failed":
      return (
        <section aria-label="The clone did not finish" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {stage.job.state === "cancelled" ? "Clone cancelled" : "The clone failed"}
          </h2>
          {stage.job.message ? (
            <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
              {stage.job.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={again}>
              Try again
            </Button>
          </div>
        </section>
      );
  }
}
