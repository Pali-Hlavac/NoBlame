import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAppSettings } from "@/features/settings";
import { events, type JobDto } from "@/shared/ipc/bindings";
import { actionDone } from "@/shared/lib/actionDone";

import { jobKeys, withJob } from "../api/jobs";
import { batchJobEnded } from "../lib/batch";
import { jobEnded } from "../lib/followUp";
import { isOwnJob, onLateOwnJob } from "../lib/own";
import { repositoryName } from "../lib/format";
import { showJobProgress, takeJobToast } from "../lib/toasts";
import { showOutput, showsOutputOfEveryJob, useOutputWindow } from "../store/output";
import { showJobs } from "../store/panel";

/** Jobs a task window is opened for (Pull, Push, Fetch, Clone). */
function isTaskJob(kind: JobDto["kind"]): kind is "pull" | "push" | "fetch" | "clone" {
  return kind === "pull" || kind === "push" || kind === "fetch" || kind === "clone";
}

/**
 * Tells how a job ended: a toast naming the repository (in place of the job's progress toast),
 * with the log one click away.
 */
function announce(job: JobDto): void {
  const where = repositoryName(job.repoPath);
  // An update keeps the progress toast's fields unless given: drop its Cancel button.
  const replacing = { id: takeJobToast(job.id), action: undefined };
  switch (job.state) {
    case "succeeded":
      toast.success(`${job.title}: ${job.message ?? "done"}`, { ...replacing, description: where });
      return;
    case "failed":
      toast.error(`${job.title} failed`, {
        ...replacing,
        description: `${where}\n${job.message ?? ""}`,
        classNames: { description: "whitespace-pre-line" },
        action: {
          label: "Show log",
          onClick: () => {
            showJobs(job.id);
          },
        },
      });
      return;
    case "cancelled":
      // The message says what was cleaned up (a partly cloned folder).
      toast(`${job.title} cancelled`, {
        ...replacing,
        description: job.message ? `${where}\n${job.message}` : where,
        classNames: { description: "whitespace-pre-line" },
      });
      return;
    case "running":
      return;
  }
}

/**
 * Keeps the jobs list current from `JobUpdated` events, opens the Git output window for new jobs
 * when `showOutputWindow` (Settings), and announces finished jobs. Mounted once in each window;
 * the list has every job, but only the window that started a job shows and announces it.
 */
function showNewJob(queryClient: ReturnType<typeof useQueryClient>, id: number): void {
  // Joins jobs still running (a batch); after they all ended, a new action starts afresh.
  const jobs = queryClient.getQueryData<JobDto[]>(jobKeys.list());
  const { jobIds } = useOutputWindow.getState();
  const running = jobs?.some(
    (other) => other.id !== id && jobIds.includes(other.id) && other.state === "running",
  );
  showOutput(id, running ? "add" : "replace");
}

export function useJobEvents(): void {
  const queryClient = useQueryClient();
  const { showOutputWindow } = useAppSettings().jobs;
  // Read by the listener, which is not set up again when the setting changes.
  const showOutputRef = useRef(showOutputWindow);
  useEffect(() => {
    showOutputRef.current = showOutputWindow;
  }, [showOutputWindow]);
  useEffect(() => {
    const showsOutput = (): boolean => showOutputRef.current || showsOutputOfEveryJob();
    // A job whose first event came before this window knew it started it.
    onLateOwnJob((id) => {
      const job = queryClient
        .getQueryData<JobDto[]>(jobKeys.list())
        ?.find((each) => each.id === id);
      if (job?.state === "running" && showsOutput()) showNewJob(queryClient, id);
    });
    const unlisten = events.jobUpdated.listen(({ payload: { job } }) => {
      const jobs = queryClient.getQueryData<JobDto[]>(jobKeys.list());
      const before = jobs?.find((other) => other.id === job.id);
      queryClient.setQueryData<JobDto[]>(jobKeys.list(), (list) => withJob(list, job));
      const isNew = before === undefined && job.state === "running";
      if (!isOwnJob(job.id, isNew)) {
        jobEnded(job);
        return;
      }
      if (isNew && showsOutput()) showNewJob(queryClient, job.id);
      if (job.state === "running") showJobProgress(job);
      if (job.state !== "running" && before?.state !== job.state) {
        jobEnded(job);
        // A batch's jobs are summed up together when its last one ends.
        if (!batchJobEnded(job)) announce(job);
        if (job.state === "succeeded" && isTaskJob(job.kind)) actionDone(job.kind);
      }
    });
    return () => {
      onLateOwnJob(null);
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [queryClient]);
}
