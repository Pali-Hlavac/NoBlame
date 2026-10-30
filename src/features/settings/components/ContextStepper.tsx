import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { useDiffSettings } from "../hooks/useDiffSettings";
import { CONTEXT_STEPS, contextLabel, stepContext } from "../lib/diff";

const BUTTON_CLASSES =
  "flex items-center justify-center px-1.5 py-0.5 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40";

/**
 * Unchanged lines around each change: − and + step through {@link CONTEXT_STEPS}, and
 * "Whole file" shows everything (switching it off goes back to the number of lines).
 */
export function ContextStepper({ className }: { className?: string }) {
  const [settings, change] = useDiffSettings();
  const { contextLines, wholeFile } = settings;
  const fewest = CONTEXT_STEPS[0] ?? 0;
  const most = CONTEXT_STEPS.at(-1) ?? contextLines;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        role="group"
        aria-label="Unchanged lines around each change"
        className="flex items-center overflow-hidden rounded border border-border"
      >
        <button
          type="button"
          aria-label="Fewer unchanged lines"
          title="Fewer unchanged lines"
          disabled={wholeFile || contextLines <= fewest}
          className={BUTTON_CLASSES}
          onClick={() => {
            change({ contextLines: stepContext(contextLines, -1) });
          }}
        >
          <MinusIcon className="size-3.5" aria-hidden />
        </button>
        <span
          aria-live="polite"
          className={cn(
            "min-w-14 border-x border-border px-1.5 text-center text-xs tabular-nums",
            wholeFile && "text-muted-foreground line-through",
          )}
        >
          {contextLabel(contextLines)}
        </span>
        <button
          type="button"
          aria-label="More unchanged lines"
          title="More unchanged lines"
          disabled={wholeFile || contextLines >= most}
          className={BUTTON_CLASSES}
          onClick={() => {
            change({ contextLines: stepContext(contextLines, 1) });
          }}
        >
          <PlusIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        aria-pressed={wholeFile}
        className={cn(
          "rounded border border-border px-2 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          wholeFile ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
        )}
        onClick={() => {
          change({ wholeFile: !wholeFile });
        }}
      >
        Whole file
      </button>
    </div>
  );
}
