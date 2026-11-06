/** A job's output as the UI keeps it: the lines read so far, added to as the job writes more. */
import type { JobDto, JobOutputDto } from "@/shared/ipc/bindings";

/** Lines kept per job, as many as the backend keeps. */
export const MAX_OUTPUT_LINES = 5_000;

export interface JobOutput {
  /** The number of the next line to read (lines are counted from the job's first). */
  next: number;
  lines: readonly string[];
}

export const EMPTY_OUTPUT: JobOutput = { next: 0, lines: [] };

/** `output` with the lines just read; says how many were left out when some were dropped. */
export function appendOutput(output: JobOutput, read: JobOutputDto): JobOutput {
  const skipped = read.from - output.next;
  const added =
    skipped > 0
      ? [`… ${String(skipped)} lines left out (only the newest are kept)`, ...read.lines]
      : read.lines;
  return {
    next: read.from + read.lines.length,
    lines: [...output.lines, ...added].slice(-MAX_OUTPUT_LINES),
  };
}

/** The line git last rewrote in place (`Receiving objects: 45% (450/1000), 1.2 MiB`). */
export function progressLine(job: JobDto): string | null {
  const { progress } = job;
  if (!progress) return null;
  const percent = progress.percent === null ? "" : ` ${String(progress.percent)}%`;
  const detail = progress.detail ? ` ${progress.detail}` : "";
  return `${progress.phase}:${percent}${detail}`;
}
