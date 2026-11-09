/**
 * Batches: one job per repository started together (Pull all, Push all on a group). Their jobs
 * do not toast one by one: one toast appears at once, counts them as they end, and then sums
 * them up. Each job is still in the jobs list with its own log.
 */
import { toast } from "sonner";

import type { JobDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { showJobs } from "../store/panel";
import { repositoryName } from "./format";

/** Lines of a summary toast naming repositories; the rest are counted. */
const MAX_SUMMARY_LINES = 6;

/** How one repository of a batch ended. */
export interface BatchResult {
  path: string;
  state: "succeeded" | "failed" | "cancelled";
  /** The job's message (`Already up to date`, git's reason), or why it could not start. */
  message: string;
}

interface Batch {
  title: string;
  total: number;
  results: BatchResult[];
  toastId: string | number;
}

/** Running jobs that belong to a batch. Transient, never rendered, so not a store. */
const batchOfJob = new Map<number, Batch>();

/** One job per entry of `starts`, reported together as `title` (`Pull all in Work`). */
export function startBatch(
  title: string,
  starts: readonly { path: string; start: () => Promise<number> }[],
): void {
  if (starts.length === 0) return;
  const batch: Batch = {
    title,
    total: starts.length,
    results: [],
    toastId: toast.loading(title, { description: batchProgress(0, starts.length) }),
  };
  for (const { path, start } of starts) {
    start().then(
      (id) => {
        batchOfJob.set(id, batch);
      },
      (error: unknown) => {
        const { message, hint } = toIpcError(error);
        settle(batch, { path, state: "failed", message: hint ? `${message} ${hint}` : message });
      },
    );
  }
}

/**
 * Called for every job that ended: records it when it belongs to a batch (and returns true, so
 * it is not announced on its own).
 */
export function batchJobEnded(job: JobDto): boolean {
  const batch = batchOfJob.get(job.id);
  if (!batch || job.state === "running") return false;
  batchOfJob.delete(job.id);
  settle(batch, { path: job.repoPath, state: job.state, message: job.message ?? "" });
  return true;
}

function settle(batch: Batch, result: BatchResult): void {
  batch.results.push(result);
  if (batch.results.length < batch.total) {
    toast.loading(batch.title, {
      id: batch.toastId,
      description: batchProgress(batch.results.length, batch.total),
    });
    return;
  }
  const summary = batchSummary(batch.title, batch.results);
  const options = {
    id: batch.toastId,
    description: summary.description,
    classNames: { description: "whitespace-pre-line" },
    action: {
      label: "Show jobs",
      onClick: () => {
        showJobs();
      },
    },
  };
  if (summary.failed) toast.error(summary.title, options);
  else toast.success(summary.title, options);
}

/** `2 of 7 repositories done` (the running batch's toast). */
export function batchProgress(done: number, total: number): string {
  return `${String(done)} of ${String(total)} ${total === 1 ? "repository" : "repositories"} done`;
}

/** The toast for a finished batch: counts in the title, then a line per repository. */
export function batchSummary(
  title: string,
  results: readonly BatchResult[],
): { title: string; description: string; failed: boolean } {
  const failed = results.filter((result) => result.state === "failed");
  const cancelled = results.filter((result) => result.state === "cancelled");
  const counts = [
    `${String(results.length - failed.length - cancelled.length)} done`,
    failed.length > 0 && `${String(failed.length)} failed`,
    cancelled.length > 0 && `${String(cancelled.length)} cancelled`,
  ].filter(Boolean);
  // Failures first: they need attention.
  const order = [
    ...failed,
    ...cancelled,
    ...results.filter((result) => result.state === "succeeded"),
  ];
  const lines = order.slice(0, MAX_SUMMARY_LINES).map((result) => {
    const firstLine = result.message.split("\n")[0] ?? "";
    const text = result.state === "cancelled" ? "cancelled" : firstLine || "done";
    return `${repositoryName(result.path)}: ${text}`;
  });
  const more = order.length - lines.length;
  if (more > 0) lines.push(`and ${String(more)} more`);
  return {
    title: `${title}: ${counts.join(", ")}`,
    description: lines.join("\n"),
    failed: failed.length > 0,
  };
}
