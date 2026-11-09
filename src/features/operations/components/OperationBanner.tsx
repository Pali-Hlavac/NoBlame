import { GitMergeIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useWorkingTreeStatus } from "@/features/working-tree";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { InlineError } from "@/shared/components/InlineError";
import type { OperationDto, StepOutcomeDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useStepOperation } from "../api/operations";
import { showOutcome } from "../lib/outcome";
import { ABORT_WORDS, canSkip, operationTitle, stepToast } from "../lib/words";

interface OperationBannerProps {
  repoId: number;
}

/**
 * The bar above the commits while an operation is in progress (a merge stopped by conflicts, a
 * rebase, a cherry-pick, ...): what runs, how many files still conflict, and Continue, Skip and
 * Abort. Nothing when no operation runs.
 */
export function OperationBanner({ repoId }: OperationBannerProps) {
  const status = useWorkingTreeStatus(repoId);
  const operation = status.data?.operation;
  if (!operation) return null;
  return (
    <OperationBar
      // A new operation starts with fresh buttons (no error left from the last one).
      key={`${operation.kind}:${operation.detail ?? ""}`}
      repoId={repoId}
      operation={operation}
      conflicted={status.data?.summary.conflicted ?? 0}
    />
  );
}

interface OperationBarProps {
  repoId: number;
  operation: OperationDto;
  conflicted: number;
}

function OperationBar({ repoId, operation, conflicted }: OperationBarProps) {
  const proceed = useStepOperation(repoId, "continue");
  const skip = useStepOperation(repoId, "skip");
  const abort = useStepOperation(repoId, "abort");
  const [confirmAbort, setConfirmAbort] = useState(false);
  const busy = proceed.isPending || skip.isPending || abort.isPending;
  const title = operationTitle(operation);
  const bisect = operation.kind === "bisect";
  const onStep = (step: "continue" | "skip") => ({
    onSuccess: (outcome: StepOutcomeDto) => {
      showOutcome(stepToast(operation.kind, step, outcome));
    },
  });

  return (
    <section
      aria-label="Operation in progress"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-kind-stash/10 px-3 py-1.5 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <GitMergeIcon className="size-4 shrink-0 text-kind-stash" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium" title={title}>
            {title}
          </span>
          {conflicted > 0 ? (
            <span className="block text-xs text-destructive">
              {conflicted} {conflicted === 1 ? "file conflicts" : "files conflict"}: resolve and
              stage {conflicted === 1 ? "it" : "them"}, then continue
            </span>
          ) : (
            !bisect && (
              <span className="block text-xs text-muted-foreground">
                No conflicts left: continue to finish
              </span>
            )
          )}
        </span>
        {!bisect && (
          <Button
            size="sm"
            className="h-7"
            disabled={busy || conflicted > 0}
            title={conflicted > 0 ? "Resolve and stage the conflicted files first" : undefined}
            onClick={() => {
              proceed.mutate(undefined, onStep("continue"));
            }}
          >
            {proceed.isPending ? "Continuing…" : "Continue"}
          </Button>
        )}
        {canSkip(operation.kind) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={busy}
            title="Leave out the commit it stopped at"
            onClick={() => {
              skip.mutate(undefined, onStep("skip"));
            }}
          >
            {skip.isPending ? "Skipping…" : "Skip"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={busy}
          onClick={() => {
            setConfirmAbort(true);
          }}
        >
          {bisect ? "Stop bisecting" : "Abort"}
        </Button>
      </div>
      {proceed.error ? <InlineError error={proceed.error} /> : null}
      {skip.error ? <InlineError error={skip.error} /> : null}
      <ConfirmDialog
        open={confirmAbort}
        onOpenChange={setConfirmAbort}
        title={bisect ? "Stop bisecting?" : "Abort it?"}
        description={`${ABORT_WORDS[operation.kind]}${
          bisect ? "" : " Changes you made to resolve conflicts are lost."
        }`}
        confirmLabel={abort.isPending ? "Aborting…" : bisect ? "Stop bisecting" : "Abort"}
        destructive={!bisect}
        pending={abort.isPending}
        error={abort.error}
        onConfirm={() => {
          abort.mutate(undefined, {
            onSuccess: () => {
              setConfirmAbort(false);
              toast.success(bisect ? "Stopped bisecting" : "Aborted");
            },
          });
        }}
      />
    </section>
  );
}
