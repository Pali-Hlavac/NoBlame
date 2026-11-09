import type { JobDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { progressLabel } from "../lib/format";

interface JobToastProgressProps {
  job: JobDto;
  /** The repository's name. */
  where: string;
}

/**
 * A running job's toast body: the repository (unless the title names it, as `Clone app`), what
 * git is doing, and a small bar.
 */
export function JobToastProgress({ job, where }: JobToastProgressProps) {
  const percent = job.progress?.percent ?? null;
  const label = job.title.includes(where) ? progressLabel(job) : `${where} · ${progressLabel(job)}`;
  return (
    <span className="flex flex-col gap-1.5">
      <span className="truncate">{label}</span>
      <span
        role="progressbar"
        aria-label={`${job.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="relative block h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 block rounded-full bg-primary",
            percent === null
              ? "w-1/3 animate-indeterminate motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60"
              : "transition-[width] duration-300 ease-out",
          )}
          style={percent === null ? undefined : { width: `${String(percent)}%` }}
        />
      </span>
    </span>
  );
}
