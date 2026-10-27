import { GaugeIcon, XIcon } from "lucide-react";
import { useState } from "react";

import type { RepoSummary } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useWriteCommitGraph } from "../api/mutations";

/** Offers to write the commit-graph file when it is missing (Git Extensions does the same). */
export function CommitGraphNotice({ summary, tabPath }: { summary: RepoSummary; tabPath: string }) {
  const [dismissed, setDismissed] = useState(false);
  const write = useWriteCommitGraph(tabPath);
  if (summary.hasCommitGraph || dismissed) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-sm"
    >
      <GaugeIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">
        History loads much faster with a commit-graph file. Writing it runs{" "}
        <code className="font-mono text-xs">
          git commit-graph write --reachable --changed-paths
        </code>{" "}
        and can take a minute on very large repositories.
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
