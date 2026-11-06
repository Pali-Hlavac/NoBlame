/**
 * Background jobs (fetch, pull and push; clone later): the list is read once and then kept
 * current by `JobUpdated` events (`useJobEvents`); a job's output is read while it is shown,
 * only the lines that are new each time.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type {
  FetchRequestDto,
  JobDto,
  JobKindDto,
  PullRequestDto,
  PushRequestDto,
} from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { EMPTY_OUTPUT, appendOutput, type JobOutput } from "../lib/output";

export const jobKeys = {
  all: ["jobs"] as const,
  list: () => [...jobKeys.all, "list"] as const,
  output: (id: number) => [...jobKeys.all, "output", id] as const,
};

/** Running and recent jobs, newest first. */
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.list(),
    queryFn: () => commands.listJobs(),
    staleTime: Infinity,
  });
}

/**
 * A job's output while `enabled`: read once, then only the new lines whenever the job wrote
 * more (`job.logLines`), so a window streaming a long pull stays cheap.
 */
export function useJobOutput(job: JobDto, enabled: boolean) {
  const queryClient = useQueryClient();
  const { id, logLines } = job;
  const query = useQuery({
    queryKey: jobKeys.output(id),
    queryFn: async (): Promise<JobOutput> => {
      const before = queryClient.getQueryData<JobOutput>(jobKeys.output(id)) ?? EMPTY_OUTPUT;
      return appendOutput(before, await commands.getJobOutput(id, before.next));
    },
    enabled,
    staleTime: Infinity,
  });
  const behind = (query.data?.next ?? 0) < logLines;
  const { isFetching, refetch } = query;
  useEffect(() => {
    if (enabled && behind && !isFetching) void refetch();
  }, [behind, enabled, isFetching, refetch]);
  return query;
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

/**
 * Starts `git push` of the current branch of the repository at `path` to its upstream (open or
 * not), like `startFetch`; refused when there is no upstream on a remote.
 */
export function startPushCurrent(path: string): Promise<number> {
  return unwrap(commands.pushCurrentBranch(path));
}

/** Whether a job of `kind` runs on any of `paths` (paths as given when the jobs started). */
export function useJobRunning(paths: readonly string[], kind: JobKindDto): boolean {
  const { data } = useJobs();
  return (
    data?.some(
      (job) => job.state === "running" && job.kind === kind && paths.includes(job.repoPath),
    ) ?? false
  );
}

/** `jobs` with `job` put in its place (or in front, when new). */
export function withJob(jobs: readonly JobDto[] | undefined, job: JobDto): JobDto[] {
  const list = jobs ?? [];
  return list.some((other) => other.id === job.id)
    ? list.map((other) => (other.id === job.id ? job : other))
    : [job, ...list];
}
