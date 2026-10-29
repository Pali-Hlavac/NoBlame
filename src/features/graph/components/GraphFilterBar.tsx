import { XIcon } from "lucide-react";

import type { GraphFilterDto, GraphSummary } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { NO_FILTER, isFiltered, useSetGraphFilter } from "../api/filter";
import { formatShownCommits } from "../lib/format";
import { BranchPicker } from "./BranchPicker";
import { FILTER_CONTROL_CLASSES } from "./filterStyles";

interface GraphFilterBarProps {
  repoId: number;
  repoPath: string;
  summary: GraphSummary;
}

function Toggle(props: { label: string; title: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      title={props.title}
      className={cn(
        FILTER_CONTROL_CLASSES,
        props.pressed ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

/** What the repository tab shows: whose history, first parents only, without merges. */
export function GraphFilterBar({ repoId, repoPath, summary }: GraphFilterBarProps) {
  const setFilter = useSetGraphFilter(repoId, repoPath);
  // While a change is applied, show it already (and build the next one on top of it).
  const filter = (setFilter.isPending ? setFilter.variables : undefined) ?? summary.filter;
  const change = (patch: Partial<GraphFilterDto>) => {
    setFilter.mutate({ ...filter, ...patch });
  };

  return (
    <div
      role="group"
      aria-label="Filter commits"
      className="flex h-8 shrink-0 items-center gap-1.5 overflow-hidden border-b border-border px-2"
    >
      <BranchPicker
        repoId={repoId}
        tips={filter.tips}
        onChange={(tips) => {
          change({ tips });
        }}
      />
      <Toggle
        label="First parent"
        title="Follow only the first parent of merges: the main line of each branch"
        pressed={filter.firstParent}
        onClick={() => {
          change({ firstParent: !filter.firstParent });
        }}
      />
      <Toggle
        label="No merges"
        title="Hide merge commits"
        pressed={filter.noMerges}
        onClick={() => {
          change({ noMerges: !filter.noMerges });
        }}
      />
      <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="truncate" aria-live="polite">
          {setFilter.isPending
            ? "Filtering…"
            : isFiltered(summary.filter) && formatShownCommits(summary.rows, summary.totalRows)}
        </span>
        {isFiltered(filter) && (
          <button
            type="button"
            className={FILTER_CONTROL_CLASSES}
            onClick={() => {
              setFilter.mutate(NO_FILTER);
            }}
          >
            <XIcon className="size-3.5" aria-hidden />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
