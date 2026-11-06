import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { events, type JobDto } from "@/shared/ipc/bindings";

import { jobKeys, withJob } from "../api/jobs";
import { batchJobEnded } from "../lib/batch";
import { repositoryName } from "../lib/format";
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
 * Keeps the jobs list current from `JobUpdated` events and announces finished jobs. Mounted
 * once, in the main window.
 */
export function useJobEvents(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unlisten = events.jobUpdated.listen(({ payload: { job } }) => {
      const before = queryClient
        .getQueryData<JobDto[]>(jobKeys.list())
        ?.find((other) => other.id === job.id);
      queryClient.setQueryData<JobDto[]>(jobKeys.list(), (jobs) => withJob(jobs, job));
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
