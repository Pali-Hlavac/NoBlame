import { SearchCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { goToCommit } from "@/features/graph";
import { useActiveRepository } from "@/features/repositories";
import { selectRow } from "@/features/selection";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { InlineError } from "@/shared/components/InlineError";
import type { BisectMarkDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useBisectState } from "../api/bisect";
import { useStepOperation } from "../api/operations";
import { useBisectActions } from "../hooks/useBisectActions";
import { bisectLine, canMarkHead, marksLine } from "../lib/bisect";
import { useBisectCounts } from "../store/bisect";
import { ABORT_WORDS } from "../lib/words";

/** Selects `id` in the graph of the repository whose tab is `path`. */
async function showCommit(repoId: number, path: string, id: string): Promise<void> {
  const found = await goToCommit(repoId, id);
  if (found.status === "shown" && found.row !== null) selectRow(path, found.row);
  else toast.info("The graph's filter hides this commit. Clear the filter to see it.");
}

const MARK_BUTTONS: readonly { mark: BisectMarkDto; label: string; title: string }[] = [
  { mark: "good", label: "Good", title: "The checked-out commit does not have the problem" },
  { mark: "bad", label: "Bad", title: "The checked-out commit has the problem" },
  { mark: "skip", label: "Skip", title: "The checked-out commit cannot be tested" },
];

/**
 * The bar while bisecting: what to do next or the commit being tested and how many are left,
 * Good, Bad and Skip for it, the first bad commit once found, and Stop bisecting.
 */
export function BisectBar({ repoId }: { repoId: number }) {
  const state = useBisectState(repoId, true).data;
  const mark = useBisectActions(repoId);
  const stop = useStepOperation(repoId, "abort");
  const path = useActiveRepository().tab?.path;
  const [confirmStop, setConfirmStop] = useState(false);
  const counts = useBisectCounts((all) => all.counts[repoId]);
  const found = state?.firstBad ?? null;
  const stopNow = () => {
    stop.mutate(undefined, {
      onSuccess: () => {
        setConfirmStop(false);
        toast.success("Stopped bisecting");
      },
    });
  };
  return (
    <section
      aria-label="Bisecting"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-kind-history/10 px-3 py-1.5 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchCheckIcon className="size-4 shrink-0 text-kind-history" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {state ? bisectLine(state, counts) : "Bisecting"}
          </span>
          {state && marksLine(state) && (
            <span className="block text-xs text-muted-foreground">Marked: {marksLine(state)}</span>
          )}
        </span>
        {state &&
          canMarkHead(state) &&
          MARK_BUTTONS.map((button) => (
            <Button
              key={button.mark}
              size="sm"
              variant={button.mark === "skip" ? "outline" : "default"}
              className="h-7"
              title={button.title}
              onClick={() => {
                mark(null, button.mark);
              }}
            >
              {button.label}
            </Button>
          ))}
        {found && path && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => void showCommit(repoId, path, found.id)}
          >
            Show it
          </Button>
        )}
        <Button
          size="sm"
          variant={found ? "default" : "outline"}
          className="h-7"
          disabled={stop.isPending}
          onClick={() => {
            if (found) stopNow();
            else setConfirmStop(true);
          }}
        >
          {stop.isPending ? "Stopping…" : "Stop bisecting"}
        </Button>
      </div>
      {found && stop.error ? <InlineError error={stop.error} /> : null}
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop bisecting?"
        description={`${ABORT_WORDS.bisect} The marks so far are forgotten.`}
        confirmLabel="Stop bisecting"
        pending={stop.isPending}
        error={stop.error}
        onConfirm={stopNow}
      />
    </section>
  );
}
