import { HistoryIcon, SearchXIcon } from "lucide-react";
import { useEffect } from "react";

import { shortId, useGraphSummary } from "@/features/graph";
import { WithActiveRepository } from "@/features/repositories";
import { HISTORY_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { FileHistoryDto, GraphFilterDto } from "@/shared/ipc/bindings";

import { useFileHistory } from "../api/history";
import { type HistoryTarget, useHistoryTarget } from "../store/history";
import { HistoryList } from "./HistoryList";

const counts = new Intl.NumberFormat("en-US");

function splitPath(path: string): { name: string; folder: string } {
  const slash = path.lastIndexOf("/");
  return { name: path.slice(slash + 1), folder: slash < 0 ? "" : path.slice(0, slash) };
}

/** "1,234 commits", and which branches when the graph's filter narrows them. */
function describeCount(total: number, filter: GraphFilterDto | undefined): string {
  const commits = total === 1 ? "1 commit" : `${counts.format(total)} commits`;
  const parts = [];
  if (filter && filter.tips.type !== "all") parts.push("on the branch the graph shows");
  if (filter?.firstParent) parts.push("first parents only");
  return parts.length > 0 ? `${commits} (${parts.join(", ")})` : commits;
}

/** Why the history ends early, if it does. */
function stopNotice(history: FileHistoryDto): string | undefined {
  switch (history.stopped?.kind) {
    case "missingContents":
      return `Earlier names are not followed past ${shortId(history.stopped.commit)}: this partial clone does not have the file contents needed to find them.`;
    case "tooManyRenames":
      return "The history stops after 64 renames.";
    default:
      return undefined;
  }
}

interface HistoryProps {
  repoId: number;
  repoPath: string;
}

function TargetHistory({ repoId, repoPath, target }: HistoryProps & { target: HistoryTarget }) {
  const history = useFileHistory(repoId, target.path);
  const graph = useGraphSummary(repoId);
  const { name, folder } = splitPath(target.path);
  let body;
  if (history.error) {
    body = (
      <ErrorState
        error={history.error}
        title="Could not read the history"
        onRetry={() => void history.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!history.data || !graph.data) {
    body = <LoadingState label="Reading the history…" className="flex-1" />;
  } else if (history.data.total === 0) {
    body = (
      <EmptyState
        icon={SearchXIcon}
        title="No commits"
        description={`No commit on the branches the graph shows changes ${target.path}.`}
        className="flex-1"
      />
    );
  } else {
    body = (
      <HistoryList
        repoId={repoId}
        repoPath={repoPath}
        target={target}
        total={history.data.total}
        generation={graph.data.generation}
      />
    );
  }
  const names = history.data?.previousNames ?? [];
  const notice = history.data && stopNotice(history.data);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-sm">
        <span className="font-medium">{name}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{folder}</span>
        {history.data && (
          <span className="text-xs text-muted-foreground">
            {describeCount(history.data.total, graph.data?.filter)}
          </span>
        )}
        {names.length > 0 && (
          <span className="min-w-0 truncate text-xs text-muted-foreground" title={names.join("\n")}>
            Earlier {names.length === 1 ? "name" : "names"}: {names.join(", ")}
          </span>
        )}
      </div>
      {notice && (
        <p className="shrink-0 border-b border-border px-3 py-1 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {body}
    </div>
  );
}

function ChosenHistory({ repoId, repoPath }: HistoryProps) {
  const target = useHistoryTarget(repoPath);

  useEffect(() => {
    const title = target ? `History: ${splitPath(target.path).name}` : "History";
    useTabsStore.getState().setTitle(HISTORY_TAB.id, title);
  }, [target]);

  if (!target) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No file chosen"
        description="Right-click a file or folder in Files (Alt+6) and choose File history."
        className="h-full"
      />
    );
  }
  return <TargetHistory key={target.path} repoId={repoId} repoPath={repoPath} target={target} />;
}

/**
 * The history tab: the commits that change the chosen file or folder, following a file's
 * renames, on the branches the active repository's graph shows. There is one; choosing another
 * path switches it in place.
 */
export function HistoryView() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <ChosenHistory repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
