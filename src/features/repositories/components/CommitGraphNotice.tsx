import { GaugeIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { useGraphSummary } from "@/features/graph";
import type { RepoSummary } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useWriteCommitGraph } from "../api/mutations";
import { commitGraphOffer } from "../lib/commitGraphOffer";

/**
 * Offers to write the commit-graph file when it is missing (Git Extensions does the same).
 * After a slow first load it is highlighted and says what the load cost and what writing costs.
 * NoBlame never writes the file without this click.
 */
export function CommitGraphNotice({ summary, tabPath }: { summary: RepoSummary; tabPath: string }) {
  const [dismissed, setDismissed] = useState(false);
  const write = useWriteCommitGraph(tabPath);
  const graph = useGraphSummary(summary.id);
  if (summary.hasCommitGraph || dismissed) return null;
  const offer = commitGraphOffer(graph.data);

  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 text-sm",
        offer.prominent ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40",
      )}
    >
      <GaugeIcon
        className={cn("shrink-0 text-primary", offer.prominent ? "size-5" : "size-4")}
        aria-hidden
      />
      <p className="min-w-48 flex-1 basis-64">
        {offer.message}{" "}
        <span className="text-muted-foreground">
          It runs{" "}
          <code className="font-mono text-xs">
            git commit-graph write --reachable --changed-paths
          </code>
          .
        </span>
      </p>
      <Button
        size="sm"
        disabled={write.isPending}
        onClick={() => {
          write.mutate(summary.id);
        }}
      >
        {write.isPending ? "Writing…" : "Write commit-graph"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
        }}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
