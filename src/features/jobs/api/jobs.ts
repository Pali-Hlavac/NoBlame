/**
 * Background jobs (fetch now; pull, push and clone later): the list is read once and then kept
 * current by `JobUpdated` events (`useJobEvents`); a job's log is read when it is shown.
 */
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type {
  FetchRequestDto,
  JobDto,
  PullRequestDto,
  PushRequestDto,
} from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const jobKeys = {
  all: ["jobs"] as const,
  list: () => [...jobKeys.all, "list"] as const,
  log: (id: number, lines: number) => [...jobKeys.all, "log", id, lines] as const,
};

/** Running and recent jobs, newest first. */
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.list(),
    queryFn: () => commands.listJobs(),
    staleTime: Infinity,
  });
}

/** A job's log; read again whenever it grew (`job.logLines`). */
export function useJobLog(job: JobDto, enabled: boolean) {
  return useQuery({
    queryKey: jobKeys.log(job.id, job.logLines),
    queryFn: () => commands.getJobLog(job.id),
    enabled,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/** Cancels a running job. */
export function useCancelJob() {
  return useMutation({
    mutationFn: (id: number) => commands.cancelJob(id),
  });
}

/**
 * Starts `git fetch`; resolves with the job's id once it runs (progress and the result come as
 * job events). A plain function, so menus outside React components can call it.
 */
export function startFetch(request: FetchRequestDto): Promise<number> {
  return unwrap(commands.fetchRepository(request));
}

/** Starts `git pull` of the current branch, like `startFetch`. */
export function startPull(request: PullRequestDto): Promise<number> {
  return unwrap(commands.pullRepository(request));
}

/** Starts `git push` (a branch, a tag, or deleting one on the remote), like `startFetch`. */
export function startPush(request: PushRequestDto): Promise<number> {
  return unwrap(commands.pushRepository(request));
}

/** `jobs` with `job` put in its place (or in front, when new). */
export function withJob(jobs: readonly JobDto[] | undefined, job: JobDto): JobDto[] {
  const list = jobs ?? [];
  return list.some((other) => other.id === job.id)
    ? list.map((other) => (other.id === job.id ? job : other))
    : [job, ...list];
}
