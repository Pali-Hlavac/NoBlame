import { MousePointerClickIcon } from "lucide-react";
import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { WorkingTreeDiff } from "@/features/diff";
import { useSelectedFile, useSelection } from "@/features/selection";
import type { RepoSummary } from "@/shared/ipc/bindings";
import { EmptyState } from "@/shared/components/EmptyState";

import { commitTitle } from "../lib/title";
import { changeCommitLayout, useCommitLayout } from "../store/layout";
import { CommitPanel } from "./CommitPanel";

/** The lists' width beside the diff: at first, and the narrowest and widest it can be dragged. */
const LISTS_DEFAULT_WIDTH = "34%";
const LISTS_MIN_WIDTH = "240px";
const LISTS_MAX_WIDTH = "75%";
/** The diff keeps room for a few words. */
const DIFF_MIN_WIDTH = "240px";
/** Panels must not scroll (see `Workbench.tsx`); their content scrolls. */
const PANEL_STYLE = { overflow: "hidden" } as const;

/** The diff of the file chosen in the lists. */
function ChosenDiff({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const selection = useSelection(repoPath);
  const path = useSelectedFile(repoPath);
  if (selection?.kind === "commit" || selection === undefined || path === undefined) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Choose a changed or staged file to see its diff."
        className="h-full"
      />
    );
  }
  return <WorkingTreeDiff repoId={repoId} kind={selection.kind} path={path} />;
}

interface CommitBesideProps {
  summary: RepoSummary;
  repoPath: string;
  onCommitted: (output: string) => void;
}

/**
 * The Commit module popped out: the lists and the message, with the chosen file's diff beside
 * them (the diff tab is behind the popup). The splitter between them is remembered.
 */
export function CommitBeside({ summary, repoPath, onCommitted }: CommitBesideProps) {
  // Read once: the splitter would reset on every drag step if it followed the store.
  const [defaultLayout] = useState(() => useCommitLayout.getState().beside ?? undefined);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-1.5 text-sm">
        <span className="font-medium">{commitTitle(summary.head)}</span>
        <span className="truncate text-muted-foreground">{summary.path}</span>
      </div>
      <Group
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={(beside) => {
          changeCommitLayout({ beside });
        }}
      >
        <Panel
          id="lists"
          defaultSize={LISTS_DEFAULT_WIDTH}
          minSize={LISTS_MIN_WIDTH}
          maxSize={LISTS_MAX_WIDTH}
          style={PANEL_STYLE}
        >
          <CommitPanel
            repoId={summary.id}
            repoPath={repoPath}
            showDiff={false}
            onCommitted={onCommitted}
          />
        </Panel>
        <Separator
          aria-label="Resize the lists and the diff"
          className="w-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
        />
        <Panel id="diff" minSize={DIFF_MIN_WIDTH} style={PANEL_STYLE}>
          <ChosenDiff repoId={summary.id} repoPath={repoPath} />
        </Panel>
      </Group>
    </div>
  );
}
