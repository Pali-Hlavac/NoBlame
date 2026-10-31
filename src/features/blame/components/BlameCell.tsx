import { formatCommitDate, shortId } from "@/features/graph";
import type { BlameDto, BlameHunkDto } from "@/shared/ipc/bindings";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/cn";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

import { selectCommit, showChange } from "../lib/actions";
import { describeHunk, originOf } from "../lib/hunks";
import { blamePrevious } from "../store/blame";

/** Width of the blame column beside the line numbers. */
export const BLAME_GUTTER_WIDTH = "26rem";

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short" });

interface BlameCellProps {
  repoId: number;
  repoPath: string;
  blame: BlameDto;
  hunk: BlameHunkDto;
  /** The line beside the cell (1-based). */
  line: number;
  /** 0 for the oldest commit in this blame, 1 for the newest. */
  recency: number;
}

/**
 * The blame beside one line: on a hunk's first line its commit (id, date, author, summary) as a
 * button that selects the commit, with a context menu; on the other lines only the mark that
 * shows how recent the change is.
 */
export function BlameCell({ repoId, repoPath, blame, hunk, line, recency }: BlameCellProps) {
  const { commit, path } = originOf(blame, hunk);
  const mark = (
    <span
      aria-hidden
      className="w-1 shrink-0 self-stretch bg-primary"
      // How recent the change is: the newest lines are marked strongest.
      style={{ opacity: 0.15 + 0.85 * recency }}
    />
  );
  if (!commit || path === undefined) return null;
  if (line !== hunk.line) return <span className="flex h-full">{mark}</span>;
  const date = formatCommitDate(commit.authorTime);
  const previous = commit.previous;
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          aria-label={describeHunk(hunk, commit, date)}
          title={`${commit.summary}\n${commit.authorName} <${commit.authorEmail}>, ${date}`}
          className={cn(
            "flex h-full w-full items-center gap-2 border-t border-border pr-2 text-left text-xs",
            "text-muted-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          )}
          onClick={() => void selectCommit(repoId, repoPath, commit.id)}
        >
          {mark}
          <span className="shrink-0 font-mono">{shortId(commit.id)}</span>
          <span className="w-20 shrink-0 tabular-nums">
            {commit.authorTime === null ? "" : dayFormat.format(new Date(commit.authorTime * 1000))}
          </span>
          <span className="w-24 shrink-0 truncate">{commit.authorName}</span>
          <span className="min-w-0 flex-1 truncate text-foreground">{commit.summary}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Actions for ${shortId(commit.id)}`}>
        <ContextMenuLabel className="max-w-72 truncate">{commit.summary}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void selectCommit(repoId, repoPath, commit.id)}>
          Select the commit
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void showChange(repoId, repoPath, commit.id, path)}>
          Show the change
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!previous}
          onSelect={() => {
            if (previous) blamePrevious(repoPath, { commit: previous.id, path: previous.path });
          }}
        >
          Blame the previous revision
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            copyToClipboard(commit.id, "Commit id");
          }}
        >
          Copy commit id
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
