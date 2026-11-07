/**
 * Doing something when a job ends (the Clone dialog opens the new repository). A job's end can
 * arrive before the reply that started it (a clone refused at once), so the last few ends nobody
 * waited for are kept and handed over when asked.
 */
import type { JobDto } from "@/shared/ipc/bindings";

/** Ends kept for a caller that has not asked yet. */
const MAX_EARLY_ENDS = 20;

/** Transient, never rendered, so not a store. */
const waiting = new Map<number, (job: JobDto) => void>();
const endedEarly = new Map<number, JobDto>();

/** Calls `onEnd` once the job `id` has ended (at once, if it already did). */
export function afterJob(id: number, onEnd: (job: JobDto) => void): void {
  const ended = endedEarly.get(id);
  if (ended) {
    endedEarly.delete(id);
    onEnd(ended);
    return;
  }
  waiting.set(id, onEnd);
}

/** Called by the job events for every job that ended. */
export function jobEnded(job: JobDto): void {
  const onEnd = waiting.get(job.id);
  if (onEnd) {
    waiting.delete(job.id);
    onEnd(job);
    return;
  }
  endedEarly.set(job.id, job);
  const oldest = endedEarly.keys().next();
  if (endedEarly.size > MAX_EARLY_ENDS && oldest.done !== true) endedEarly.delete(oldest.value);
}
