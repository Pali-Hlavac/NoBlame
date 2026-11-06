/** Words and numbers for the jobs list. */
import type { JobDto } from "@/shared/ipc/bindings";

/** The last folder of a repository path (`C:\code\app` → `app`). */
export function repositoryName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? path;
}

/** `Receiving objects 45%`, the phase alone, or `Starting…` before git said anything. */
export function progressLabel(job: JobDto): string {
  const { progress } = job;
  if (!progress) return "Starting…";
  return progress.percent === null
    ? progress.phase
    : `${progress.phase} ${String(progress.percent)}%`;
}

const SECONDS_PER_MINUTE = 60;

/** How long it took or has been running: `0.4 s`, `12 s`, `3 min 5 s`. */
export function durationLabel(job: JobDto, nowSeconds: number): string {
  // f64 fields arrive as `number | null` (NaN becomes null); a missing start counts as now.
  const seconds = Math.max(0, (job.finishedAt ?? nowSeconds) - (job.startedAt ?? nowSeconds));
  if (seconds < 10) return `${seconds.toFixed(1)} s`;
  if (seconds < SECONDS_PER_MINUTE) return `${String(Math.round(seconds))} s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return `${String(minutes)} min ${String(Math.round(seconds % SECONDS_PER_MINUTE))} s`;
}
