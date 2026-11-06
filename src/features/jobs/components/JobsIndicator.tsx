import { ListChecksIcon, LoaderCircleIcon } from "lucide-react";

import { useNow } from "@/shared/hooks/useNow";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import { useJobs } from "../api/jobs";
import { progressLabel } from "../lib/format";
import { setJobsOpen, useJobsPanel } from "../store/panel";
import { JobRow } from "./JobRow";

/** How often running jobs' durations are redrawn. */
const CLOCK_INTERVAL_MS = 1000;
const MS_PER_SECOND = 1000;

/**
 * Status-bar entry for background jobs: the running one with its progress, or "Jobs" once any
 * ran. Clicking lists running and recent jobs with cancel, the command line and the log.
 */
export function JobsIndicator() {
  const jobs = useJobs().data ?? [];
  const { open, expanded } = useJobsPanel();
  const running = jobs.filter((job) => job.state === "running");
  const now = useNow(CLOCK_INTERVAL_MS, open && running.length > 0) / MS_PER_SECOND;
  if (jobs.length === 0) return null;
  const first = running.at(-1);
  const label = first
    ? `${first.title}: ${progressLabel(first)}${running.length > 1 ? ` (+${String(running.length - 1)})` : ""}`
    : "Jobs";
  return (
    <Popover open={open} onOpenChange={setJobsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 max-w-72 gap-1.5 px-2 text-xs"
          aria-label={`${label}. Show background jobs`}
        >
          {first ? (
            <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ListChecksIcon className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 p-0" aria-label="Background jobs">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
          Background jobs
        </div>
        <ul className="max-h-[60vh] divide-y divide-border overflow-auto">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} expanded={expanded === job.id} nowSeconds={now} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
