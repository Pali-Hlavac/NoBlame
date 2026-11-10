import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GitBranchIcon,
  GlobeIcon,
  TagIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { BranchRow } from "../lib/rows";
import { trackingText, type BranchTracking } from "../lib/tracking";

// The list holds no bisect marks (`list_refs` leaves them out); the type has them.
const ICONS = {
  branch: GitBranchIcon,
  remote: GlobeIcon,
  tag: TagIcon,
  head: GitBranchIcon,
  bisect: GitBranchIcon,
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** The day of a ref's commit (empty when it has none). */
function commitDay(seconds: number | null): string {
  return seconds === null ? "" : dateFormat.format(new Date(seconds * 1000));
}

interface BranchRowViewProps {
  row: BranchRow;
  active: boolean;
  /** Show the day of each ref's commit (when sorted by it). */
  showDate: boolean;
  /** A local branch's upstream and ahead/behind, when it has one. */
  tracking?: BranchTracking | undefined;
}

/** One row of the Branches list: a section header or a ref. */
export function BranchRowView({ row, active, showDate, tracking }: BranchRowViewProps) {
  if (row.type === "section") {
    const Chevron = row.collapsed ? ChevronRightIcon : ChevronDownIcon;
    return (
      <div
        className={cn(
          "flex h-full cursor-default items-center gap-1 px-2 text-xs font-semibold text-muted-foreground uppercase",
          active && "bg-accent text-accent-foreground",
        )}
      >
        <Chevron className="size-3.5" aria-hidden />
        <span className="truncate">{row.title}</span>
        <span className="font-normal tabular-nums">{row.count}</span>
      </div>
    );
  }
  const { label, row: commitRow, commitTime } = row.entry;
  const Icon = ICONS[label.kind];
  const day = commitDay(commitTime);
  const title =
    commitRow === null
      ? `${label.name} (its commit is not shown: not a commit, or hidden by the filter)`
      : day
        ? `${label.name}, last commit ${day}`
        : label.name;
  return (
    <div
      title={
        tracking
          ? `${title}
${trackingText(tracking)}`
          : title
      }
      className={cn(
        "flex h-full cursor-default items-center gap-2 pr-2 pl-6 text-sm hover:bg-muted/60",
        active && "bg-accent text-accent-foreground hover:bg-accent",
        commitRow === null && "opacity-50",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn("truncate", label.isHead && "font-semibold")}>{row.display}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {tracking && <TrackingBadge tracking={tracking} />}
        {showDate && day && (
          <span className="text-xs text-muted-foreground tabular-nums">{day}</span>
        )}
        {label.isHead && (
          <span className="rounded bg-ref-head px-1 text-[10px] font-semibold text-foreground">
            HEAD
          </span>
        )}
      </span>
    </div>
  );
}

/** "gone", or the commits to push (↑) and to pull (↓); nothing when even or not counted yet. */
function TrackingBadge({ tracking }: { tracking: BranchTracking }) {
  if (tracking.gone) {
    return <span className="text-xs text-muted-foreground italic">gone</span>;
  }
  const { counts } = tracking;
  if (!counts || (counts.ahead === 0 && counts.behind === 0)) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      {counts.ahead > 0 && (
        <span className="flex items-center">
          <ArrowUpIcon className="size-3" aria-hidden />
          {counts.ahead}
        </span>
      )}
      {counts.behind > 0 && (
        <span className="flex items-center">
          <ArrowDownIcon className="size-3" aria-hidden />
          {counts.behind}
        </span>
      )}
    </span>
  );
}
