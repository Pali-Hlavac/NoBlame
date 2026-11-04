import { cn } from "@/shared/lib/cn";

import { SUMMARY_HARD_LIMIT, SUMMARY_SOFT_LIMIT, checkSummary } from "../lib/message";

const LEVEL_CLASS = {
  ok: "text-muted-foreground",
  long: "text-warning",
  "too-long": "text-destructive",
} as const;

const LEVEL_TITLE = {
  ok: `Keep the summary within ${SUMMARY_SOFT_LIMIT} characters.`,
  long: `Summaries are best kept within ${SUMMARY_SOFT_LIMIT} characters.`,
  "too-long": `Many tools cut summaries after ${SUMMARY_HARD_LIMIT} characters.`,
} as const;

/** The summary's length against the conventions, and a warning when line 2 is not empty. */
export function SummaryHint({ message }: { message: string }) {
  const summary = checkSummary(message);
  if (summary.length === 0) return null;
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs">
      {summary.secondLineUsed && (
        <span className="truncate text-warning" title="Git reads line 2 as part of the summary.">
          Leave line 2 empty
        </span>
      )}
      <span
        className={cn("tabular-nums", LEVEL_CLASS[summary.level])}
        title={LEVEL_TITLE[summary.level]}
      >
        <span className="sr-only">Summary length: </span>
        {summary.length}/{SUMMARY_SOFT_LIMIT}
      </span>
    </span>
  );
}
