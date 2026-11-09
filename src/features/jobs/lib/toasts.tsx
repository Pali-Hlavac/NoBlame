/**
 * One toast per job started from the UI: it appears the moment the action is chosen ("Fetching…",
 * before git even runs), follows the job's progress with a Cancel button, and then turns into
 * how it ended. Jobs of a batch have one toast for the whole batch (`batch.ts`).
 */
import { toast } from "sonner";

import type { JobDto, JobKindDto } from "@/shared/ipc/bindings";
import { commands } from "@/shared/ipc/client";

import { JobToastProgress } from "../components/JobToastProgress";
import { repositoryName } from "./format";

type ToastId = string | number;

/** What a starting job's toast says before git has said anything. */
export const STARTING_LABELS: Readonly<Record<JobKindDto, string>> = {
  fetch: "Fetching…",
  pull: "Pulling…",
  push: "Pushing…",
  clone: "Cloning…",
};

/** Updates and ends that arrived before their job's id did, kept for a few jobs. */
const MAX_EARLY = 20;

/** Transient, never rendered, so not a store. */
const toastOfJob = new Map<number, ToastId>();
const endedUntracked = new Set<number>();
/** The last update of running jobs without a toast (yet): shown once the toast is bound. */
const runningUntracked = new Map<number, JobDto>();

/** Forgets the oldest entries beyond `MAX_EARLY`. */
function trim(kept: Set<number> | Map<number, unknown>): void {
  for (const key of kept.keys()) {
    if (kept.size <= MAX_EARLY) return;
    kept.delete(key);
  }
}

/** Shows the toast of a job of `kind` about to start; returns its id for `bindJobToast`. */
export function startingToast(kind: JobKindDto): ToastId {
  return toast.loading(STARTING_LABELS[kind]);
}

/**
 * Hands the toast `toastId` to the job `jobId` once it runs. When the job already ended (and was
 * announced in a toast of its own), the starting toast just goes.
 */
export function bindJobToast(jobId: number, toastId: ToastId): void {
  if (endedUntracked.delete(jobId)) {
    toast.dismiss(toastId);
    return;
  }
  toastOfJob.set(jobId, toastId);
  const running = runningUntracked.get(jobId);
  runningUntracked.delete(jobId);
  if (running) showJobProgress(running);
}

/** Shows a running job's progress in its toast, if it has one. */
export function showJobProgress(job: JobDto): void {
  if (job.state !== "running") return;
  const id = toastOfJob.get(job.id);
  if (id === undefined) {
    runningUntracked.set(job.id, job);
    trim(runningUntracked);
    return;
  }
  toast.loading(job.title, {
    id,
    description: <JobToastProgress job={job} where={repositoryName(job.repoPath)} />,
    action: {
      label: "Cancel",
      onClick: (event) => {
        // The toast stays and says "cancelled" when git has stopped.
        event.preventDefault();
        void commands.cancelJob(job.id);
      },
    },
  });
}

/**
 * The toast an ended job's result replaces (undefined: a new toast). Remembers jobs that ended
 * before their toast was bound, so `bindJobToast` drops the starting toast instead.
 */
export function takeJobToast(jobId: number): ToastId | undefined {
  runningUntracked.delete(jobId);
  const id = toastOfJob.get(jobId);
  if (id !== undefined) {
    toastOfJob.delete(jobId);
    return id;
  }
  endedUntracked.add(jobId);
  trim(endedUntracked);
  return undefined;
}
