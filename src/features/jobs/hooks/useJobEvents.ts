import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAppSettings } from "@/features/settings";
import { events, type JobDto } from "@/shared/ipc/bindings";

import { jobKeys, withJob } from "../api/jobs";
import { batchJobEnded } from "../lib/batch";
import { repositoryName } from "../lib/format";
import { useOutputWindow, showOutput } from "../store/output";
import { showJobs } from "../store/panel";

/** Tells how a job ended: a toast naming the repository, with the log one click away. */
function announce(job: JobDto): void {
  const where = repositoryName(job.repoPath);
  switch (job.state) {
    case "succeeded":
      toast.success(`${job.title}: ${job.message ?? "done"}`, { description: where });
      return;
    case "failed":
      toast.error(`${job.title} failed`, {
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
      toast(`${job.title} cancelled`, { description: where });
      return;
    case "running":
      return;
  }
}

/**
 * Keeps the jobs list current from `JobUpdated` events, opens the Git output window for new jobs
 * when `showOutputWindow` (Settings), and announces finished jobs. Mounted once, in the main
 * window.
 */
export function useJobEvents(): void {
  const queryClient = useQueryClient();
  const { showOutputWindow } = useAppSettings().jobs;
  // Read by the listener, which is not set up again when the setting changes.
  const showOutputRef = useRef(showOutputWindow);
  useEffect(() => {
    showOutputRef.current = showOutputWindow;
  }, [showOutputWindow]);
  useEffect(() => {
    const unlisten = events.jobUpdated.listen(({ payload: { job } }) => {
      const jobs = queryClient.getQueryData<JobDto[]>(jobKeys.list());
      const before = jobs?.find((other) => other.id === job.id);
      queryClient.setQueryData<JobDto[]>(jobKeys.list(), (list) => withJob(list, job));
      if (before === undefined && job.state === "running" && showOutputRef.current) {
        // Joins jobs still running (a batch); after they all ended, a new action starts afresh.
        const { jobIds } = useOutputWindow.getState();
        const running = jobs?.some(
          (other) => jobIds.includes(other.id) && other.state === "running",
        );
        showOutput(job.id, running ? "add" : "replace");
      }
      // A batch's jobs are summed up together when its last one ends.
      if (job.state !== "running" && before?.state !== job.state && !batchJobEnded(job)) {
        announce(job);
      }
    });
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [queryClient]);
}
