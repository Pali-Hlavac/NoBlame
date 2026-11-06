import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleSlashIcon,
  CopyIcon,
  LoaderCircleIcon,
  SquareTerminalIcon,
  XCircleIcon,
} from "lucide-react";

import type { JobDto, JobStateDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useCancelJob, useJobOutput } from "../api/jobs";
import { durationLabel, progressLabel, repositoryName } from "../lib/format";
import { showOutput } from "../store/output";
import { setJobsOpen, toggleJobLog } from "../store/panel";

const STATE_ICONS: Record<JobStateDto, typeof CheckCircle2Icon> = {
  running: LoaderCircleIcon,
  succeeded: CheckCircle2Icon,
  failed: XCircleIcon,
  cancelled: CircleSlashIcon,
};

const STATE_CLASSES: Record<JobStateDto, string> = {
  running: "animate-spin text-muted-foreground",
  succeeded: "text-primary",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

const STATE_WORDS: Record<JobStateDto, string> = {
  running: "running",
  succeeded: "done",
  failed: "failed",
  cancelled: "cancelled",
};

interface JobRowProps {
  job: JobDto;
  expanded: boolean;
  nowSeconds: number;
}

/** One job: what, where, how far or how it ended; cancel, the command line and its log. */
export function JobRow({ job, expanded, nowSeconds }: JobRowProps) {
  const cancel = useCancelJob();
  const log = useJobOutput(job, expanded);
  const Icon = STATE_ICONS[job.state];
  const running = job.state === "running";
  const percent = job.progress?.percent ?? null;
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn("size-4 shrink-0", STATE_CLASSES[job.state])}
          aria-label={STATE_WORDS[job.state]}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{job.title}</div>
          <div className="truncate text-xs text-muted-foreground" title={job.repoPath}>
            {repositoryName(job.repoPath)} · {durationLabel(job, nowSeconds)}
          </div>
        </div>
        {running && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate(job.id);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      {running && (
        <div className="flex flex-col gap-1 pl-6">
          <div
            role="progressbar"
            aria-label={`${job.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            aria-valuetext={progressLabel(job)}
            className="h-1.5 overflow-hidden rounded bg-muted"
          >
            <div
              className={cn("h-full bg-primary", percent === null && "w-1/3 animate-pulse")}
              style={percent === null ? undefined : { width: `${String(percent)}%` }}
            />
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {progressLabel(job)}
            {job.progress?.detail ? ` · ${job.progress.detail}` : ""}
          </div>
        </div>
      )}
      {job.message && !running && (
        <p
          className={cn(
            "pl-6 text-xs whitespace-pre-line",
            job.state === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {job.message}
        </p>
      )}
      <div className="flex items-center gap-1 pl-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1 text-xs"
          aria-expanded={expanded}
          onClick={() => {
            toggleJobLog(job.id);
          }}
        >
          <Chevron className="size-3.5" aria-hidden />
          Log ({job.logLines})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1 text-xs"
          title={job.command}
          onClick={() => {
            copyToClipboard(job.command, "Command");
          }}
        >
          <CopyIcon className="size-3.5" aria-hidden />
          Copy command
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1 text-xs"
          aria-label={`Show the output of ${job.title} in a window`}
          onClick={() => {
            setJobsOpen(false);
            showOutput(job.id, "select");
          }}
        >
          <SquareTerminalIcon className="size-3.5" aria-hidden />
          Output window
        </Button>
      </div>
      {expanded && (
        <pre
          aria-label={`Log of ${job.title}`}
          className="ml-6 max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap"
        >
          <span className="text-muted-foreground">$ {job.command}</span>
          {"\n"}
          {log.data ? log.data.lines.join("\n") : "…"}
        </pre>
      )}
    </li>
  );
}
