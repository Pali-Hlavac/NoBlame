/** What the app is doing right now, for the status bar: background jobs and repository changes. */
import { useMutationState } from "@tanstack/react-query";

import { useJobs } from "@/features/jobs";
import { useSettledValue } from "@/shared/hooks/useSettledValue";

/** Quick changes (staging a file) finish before this and are not shown, so nothing flashes. */
const ACTION_DELAY_MS = 150;

export interface Work {
  /** Anything running: the status bar's strip moves. */
  busy: boolean;
  /** A change running for a moment (`Checking out the branch`), else null. */
  action: string | null;
  /** Percent of the one running job, when git knows it; null: unknown (the strip slides). */
  percent: number | null;
}

/**
 * Running jobs and mutations with an `activity` (see `query-client.ts`). Jobs count at once,
 * they always take a while; a change only once it has run for `ACTION_DELAY_MS`.
 */
export function useWork(): Work {
  const running = (useJobs().data ?? []).filter((job) => job.state === "running");
  const activities = useMutationState({
    filters: { status: "pending" },
    select: (mutation) => mutation.meta?.activity,
  });
  const current = activities.find((activity) => activity !== undefined) ?? null;
  const settled = useSettledValue(current, ACTION_DELAY_MS);
  // Shown once it has lasted a moment; gone as soon as it ends.
  const action = current !== null && settled !== null ? current : null;
  const only = running.length === 1 && action === null ? running[0] : undefined;
  return {
    busy: running.length > 0 || action !== null,
    action,
    percent: only?.progress?.percent ?? null,
  };
}
