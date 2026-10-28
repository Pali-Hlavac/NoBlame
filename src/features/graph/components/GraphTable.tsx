import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { selectRow, useSelectedRow } from "@/features/selection";
import type { CommitRowDto, GraphSummary } from "@/shared/ipc/bindings";
import { useElementSize } from "@/shared/hooks/useElementSize";

import { useCommitPages } from "../api/graph";
import { useBlockCache } from "../hooks/useBlockCache";
import { usePalette } from "../hooks/usePalette";
import {
  GRAPH_PADDING_PX,
  LANE_WIDTH_PX,
  MAX_VISIBLE_LANES,
  PAGE_ROWS,
  PREFETCH_MARGIN,
  ROW_HEIGHT_PX,
} from "../lib/constants";
import { layoutColumns } from "../lib/columns";
import { pagesFor } from "../lib/format";
import { nextRow } from "../lib/navigation";
import { computeViewport, scrollTopToReveal } from "../lib/viewport";
import { useGraphViewStore } from "../store/graphView";
import { GraphCanvas } from "./GraphCanvas";
import { GraphRows } from "./GraphRows";

interface GraphTableProps {
  repoId: number;
  repoPath: string;
  summary: GraphSummary;
}

/** The commit list: a scrollable spacer with a sticky layer holding the canvas and the rows. */
export function GraphTable({ repoId, repoPath, summary }: GraphTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(
    () => useGraphViewStore.getState().scrollTop[repoPath] ?? 0,
  );
  const selected = useSelectedRow(repoPath);
  const { cache, version } = useBlockCache(repoId);
  const palette = usePalette();
  const idPrefix = useId();

  const rowCount = summary.rows;
  const viewport = useMemo(
    () => computeViewport(scrollTop, size.height, rowCount),
    [scrollTop, size.height, rowCount],
  );
  const graphWidth =
    GRAPH_PADDING_PX * 2 +
    Math.min(Math.max(summary.maxLanes, 1), MAX_VISIBLE_LANES) * LANE_WIDTH_PX;
  const columns = layoutColumns(size.width, graphWidth);

  const pageCount = Math.ceil(rowCount / PAGE_ROWS);
  const pages = pagesFor(
    viewport.firstRow,
    viewport.lastRow,
    PAGE_ROWS,
    PREFETCH_MARGIN,
    pageCount,
  );
  const pageResults = useCommitPages(repoId, pages);
  const rowText = (row: number): CommitRowDto | undefined => {
    const index = pages.indexOf(Math.floor(row / PAGE_ROWS));
    return pageResults[index]?.data?.[row % PAGE_ROWS];
  };

  // Restore the scroll position, or reveal HEAD the first time the repository is shown.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || size.height === 0) return;
    const remembered = useGraphViewStore.getState().scrollTop[repoPath];
    if (remembered !== undefined) {
      element.scrollTop = remembered;
    } else if (summary.headRow !== null) {
      selectRow(repoPath, summary.headRow);
      element.scrollTop = scrollTopToReveal(summary.headRow, 0, size.height, rowCount);
    }
    // Only when the view (re)appears with a measured size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.height > 0, repoPath]);

  // Keep the selection visible, also when another module selects a commit (a parent, a
  // branch). Skipped on mount so a remembered scroll position wins.
  const shownSelection = useRef(selected);
  useEffect(() => {
    const element = scrollRef.current;
    if (selected === shownSelection.current || selected === undefined || !element) return;
    shownSelection.current = selected;
    element.scrollTop = scrollTopToReveal(selected, element.scrollTop, size.height, rowCount);
  }, [selected, size.height, rowCount]);

  const select = (row: number) => {
    selectRow(repoPath, row);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const row = nextRow(event.key, selected, rowCount, Math.floor(size.height / ROW_HEIGHT_PX));
    if (row === null) return;
    event.preventDefault();
    select(row);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="grid h-7 shrink-0 items-center gap-3 border-b border-border pr-3 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: columns.template }}
        aria-hidden
      >
        <span className="pl-2">Graph</span>
        <span>Message</span>
        {columns.visible.has("author") && <span>Author</span>}
        {columns.visible.has("date") && <span>Date</span>}
        {columns.visible.has("commit") && <span>Commit</span>}
      </div>
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={`Commit history, ${rowCount} commits`}
        aria-activedescendant={
          selected !== undefined && selected >= viewport.firstRow && selected <= viewport.lastRow
            ? `${idPrefix}-${selected}`
            : undefined
        }
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          setScrollTop(top);
          useGraphViewStore.getState().rememberScroll(repoPath, top);
        }}
        onKeyDown={onKeyDown}
      >
        <div style={{ height: viewport.spacerHeight }}>
          <div className="sticky top-0 overflow-hidden" style={{ height: size.height }}>
            <GraphRows
              firstRow={viewport.firstRow}
              lastRow={viewport.lastRow}
              virtualTop={viewport.virtualTop}
              columns={columns}
              rowText={rowText}
              selected={selected}
              onSelect={select}
              idPrefix={idPrefix}
            />
            <GraphCanvas
              width={graphWidth}
              height={size.height}
              viewport={viewport}
              rowCount={rowCount}
              blockRows={summary.blockRows}
              cache={cache}
              version={version}
              palette={palette}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
