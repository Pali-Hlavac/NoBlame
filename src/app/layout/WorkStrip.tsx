import { cn } from "@/shared/lib/cn";

import type { Work } from "./useWork";

/**
 * A thin bar along the top edge of the status bar, across the whole window, while anything runs:
 * filling up when a job's percent is known, otherwise a sliding segment. Decorative: the status
 * bar's text says what runs.
 */
export function WorkStrip({ busy, percent }: Work) {
  if (!busy) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-px h-0.5 overflow-hidden"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary shadow-[0_0_6px_var(--primary)]",
          percent === null
            ? "w-1/3 animate-indeterminate motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60"
            : "transition-[width] duration-300 ease-out",
        )}
        style={percent === null ? undefined : { width: `${String(percent)}%` }}
      />
    </div>
  );
}
