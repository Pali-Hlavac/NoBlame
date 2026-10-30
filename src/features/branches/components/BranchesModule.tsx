import { ArrowDownAZIcon, CalendarClockIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useRefs } from "@/features/graph";
import { WithActiveRepository } from "@/features/repositories";
import { selectRow } from "@/features/selection";
import { useBranchSort } from "@/features/settings";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { VirtualList } from "@/shared/components/VirtualList";

import { buildRows } from "../lib/rows";
import { BranchRowView } from "./BranchRowView";

/** Height of one row of the list, in CSS pixels. */
const ROW_HEIGHT_PX = 26;

function Branches({ repoId, repoPath }: { repoId: number; repoPath: string }) {
  const refs = useRefs(repoId);
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState<number>();
  const [sort, setSort] = useBranchSort();
  const rows = useMemo(
    () => buildRows(refs.data ?? [], filter, collapsed, sort),
    [refs.data, filter, collapsed, sort],
  );
  const byDate = sort === "lastCommit";
  const SortIcon = byDate ? CalendarClockIcon : ArrowDownAZIcon;

  if (refs.error) {
    return (
      <ErrorState
        error={refs.error}
        title="Could not read the branches"
        onRetry={() => void refs.refetch()}
        className="h-full justify-center"
      />
    );
  }
  if (!refs.data) return <LoadingState label="Reading branches…" className="h-full" />;

  const activate = (index: number): void => {
    const row = rows[index];
    if (!row) return;
    if (row.type === "section") {
      setCollapsed((current) => {
        const next = new Set(current);
        if (!next.delete(row.id)) next.add(row.id);
        return next;
      });
    } else if (row.entry.row !== null) {
      selectRow(repoPath, row.entry.row);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <label className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Filter branches and tags</span>
          <input
            type="search"
            value={filter}
            placeholder="Filter branches and tags"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setFilter(event.target.value);
              setActive(undefined);
            }}
          />
        </label>
        <button
          type="button"
          aria-label={
            byDate ? "Sorted by last commit; sort by name" : "Sorted by name; sort by last commit"
          }
          title={
            byDate ? "Newest commit first (click: by name)" : "By name (click: newest commit first)"
          }
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => {
            setSort(byDate ? "name" : "lastCommit");
            setActive(undefined);
          }}
        >
          <SortIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">No branch or tag matches.</p>
      ) : (
        <VirtualList
          className="flex-1"
          label="Branches and tags"
          count={rows.length}
          rowHeight={ROW_HEIGHT_PX}
          activeIndex={active !== undefined && active < rows.length ? active : undefined}
          onActiveChange={setActive}
          onActivate={activate}
          rowLabel={(index) => {
            const row = rows[index];
            if (!row) return "";
            if (row.type === "section") {
              return `${row.title}, ${row.count}, ${row.collapsed ? "collapsed" : "expanded"}`;
            }
            return `${row.entry.label.name}${row.entry.label.isHead ? ", current branch" : ""}`;
          }}
          renderRow={(index, isActive) => {
            const row = rows[index];
            return row ? <BranchRowView row={row} active={isActive} showDate={byDate} /> : null;
          }}
        />
      )}
    </div>
  );
}

/** Branches module: local and remote branches and tags; a click selects the commit. */
export function BranchesModule() {
  return (
    <WithActiveRepository>
      {(summary, tab) => <Branches repoId={summary.id} repoPath={tab.path} />}
    </WithActiveRepository>
  );
}
