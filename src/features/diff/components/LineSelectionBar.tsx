import { MinusIcon, PlusIcon, Undo2Icon, XIcon } from "lucide-react";
import { useContext } from "react";

import { Button } from "@/shared/ui/button";

import { LineStagingContext } from "../hooks/useLineStaging";
import { chosenLines, lineCount } from "../lib/lineSelection";

/** How to choose lines, while none are. */
const HINT =
  "Click line numbers to choose changed lines (Shift+click for a range), or use the buttons on each hunk.";

/**
 * Above a working tree diff (one row high either way, so the lines below do not move) while lines are chosen: how many, and what to do with them. Shows
 * how to choose lines while none are.
 */
export function LineSelectionBar() {
  const staging = useContext(LineStagingContext);
  if (!staging) return null;
  const count = staging.selected.size;
  if (count === 0) {
    return (
      <p
        title={HINT}
        className="h-8 shrink-0 truncate border-b border-border px-3 text-xs leading-8 text-muted-foreground"
      >
        {HINT}
      </p>
    );
  }
  const lines = chosenLines(staging.selected);
  const what = lineCount(count);
  return (
    <div
      role="toolbar"
      aria-label="Chosen lines"
      className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-accent/40 px-3 text-xs"
    >
      <span className="font-medium">{what} chosen</span>
      {staging.kind === "worktree" ? (
        <>
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={staging.busy}
            onClick={() => {
              staging.run("stage", lines, what);
            }}
          >
            <PlusIcon aria-hidden />
            Stage {what}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={staging.busy}
            onClick={() => {
              staging.run("discard", lines, what);
            }}
          >
            <Undo2Icon aria-hidden />
            Discard…
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={staging.busy}
          onClick={() => {
            staging.run("unstage", lines, what);
          }}
        >
          <MinusIcon aria-hidden />
          Unstage {what}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-6 px-2 text-xs"
        onClick={staging.clear}
      >
        <XIcon aria-hidden />
        Clear
      </Button>
    </div>
  );
}
