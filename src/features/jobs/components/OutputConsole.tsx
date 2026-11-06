import { useLayoutEffect, useRef } from "react";

import type { JobDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { progressLine } from "../lib/output";

/** How close to the end (CSS pixels) still counts as "at the end" for following new output. */
const FOLLOW_SLACK_PX = 24;

interface OutputConsoleProps {
  job: JobDto;
  lines: readonly string[] | undefined;
}

/**
 * git's output like a terminal shows it: the command, every line, the line git keeps rewriting
 * (progress) while it runs, and how it ended. Follows new output while scrolled to the end.
 */
export function OutputConsole({ job, lines }: OutputConsoleProps) {
  const ref = useRef<HTMLPreElement>(null);
  const follow = useRef(true);
  const progress = job.state === "running" ? progressLine(job) : null;
  const text = lines?.join("\n") ?? "";

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [text, progress, job.state]);
  useLayoutEffect(() => {
    follow.current = true;
  }, [job.id]);

  return (
    <pre
      ref={ref}
      role="region"
      // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-label={`Output of ${job.title}`}
      className="min-h-0 flex-1 overflow-auto bg-muted/60 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onScroll={(event) => {
        const element = event.currentTarget;
        follow.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_SLACK_PX;
      }}
    >
      <span className="text-muted-foreground">$ {job.command}</span>
      {"\n"}
      {lines === undefined ? "…" : text}
      {progress && (
        <>
          {text && "\n"}
          <span className="text-muted-foreground">{progress}</span>
        </>
      )}
      {job.state !== "running" && (
        <>
          {"\n\n"}
          <span
            className={cn(
              "font-semibold",
              job.state === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {ENDINGS[job.state]}
            {/* A cancelled job's message is just "Cancelled". */}
            {job.message && job.message !== ENDINGS[job.state] ? `: ${job.message}` : ""}
          </span>
        </>
      )}
    </pre>
  );
}

const ENDINGS: Record<Exclude<JobDto["state"], "running">, string> = {
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};
