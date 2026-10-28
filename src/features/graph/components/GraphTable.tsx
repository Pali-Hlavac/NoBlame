import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { select as selectAny, useSelection, type Selection } from "@/features/selection";
import type { CommitRowDto, GraphSummary } from "@/shared/ipc/bindings";
import { useElementSize } from "@/shared/hooks/useElementSize";
import { nextRow } from "@/shared/lib/listNavigation";

import { useCommitPages } from "../api/graph";
import { useBlockCache } from "../hooks/useBlockCache";
import { usePalette } from "../hooks/usePalette";
import { useSelectionHighlight } from "../hooks/useSelectionHighlight";
import { useWorkingTreeRows } from "../hooks/useWorkingTreeRows";
import {
  GRAPH_PADDING_PX,
  LANE_WIDTH_PX,
  MAX_VISIBLE_LANES,
  PAGE_ROWS,
  PREFETCH_MARGIN,
  ROW_HEIGHT_PX,
} from "../lib/constants";
import { layoutColumns } from "../lib/columns";
import { displayRows, indexOfSelection, selectionAt } from "../lib/displayRows";
import { pagesFor } from "../lib/format";
import { computeViewport, scrollTopToReveal } from "../lib/viewport";
import { useGraphViewStore } from "../store/graphView";
import { GraphCanvas } from "./GraphCanvas";
import { GraphHeader } from "./GraphHeader";
import { GraphRows } from "./GraphRows";

interface GraphTableProps {
  repoId: number;
  repoPath: string;
  summary: GraphSummary;
}

/**
 * The commit list: a scrollable spacer with a sticky layer holding the canvas and the rows.
 * Working tree rows (if any) come first; "display indexes" count them, graph rows do not.
 */
export function GraphTable({ repoId, repoPath, summary }: GraphTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(
    () => useGraphViewStore.getState().scrollTop[repoPath] ?? 0,
  );
  const selection = useSelection(repoPath);
  const selectedRow = selection?.kind === "commit" ? selection.row : undefined;
  const { cache, version } = useBlockCache(repoId);
  const palette = usePalette();
  const highlight = useSelectionHighlight(repoId, repoPath, selectedRow);
  const idPrefix = useId();

  const rowCount = summary.rows;
  const rows = displayRows(useWorkingTreeRows(repoId), rowCount);
  const viewport = useMemo(
    () => computeViewport(scrollTop, size.height, rows.count),
    [scrollTop, size.height, rows.count],
  );
  // The same window in graph rows, for the canvas and the commit text.
  const offsetPx = rows.offset * ROW_HEIGHT_PX;
  const graphViewport = useMemo(
    () => ({
      ...viewport,
      virtualTop: viewport.virtualTop - offsetPx,
      firstRow: Math.max(0, viewport.firstRow - rows.offset),
      lastRow: viewport.lastRow - rows.offset,
    }),
    [viewport, offsetPx, rows.offset],
  );
  const selectedIndex = indexOfSelection(rows, selection);
  const graphWidth =
    GRAPH_PADDING_PX * 2 +
    Math.min(Math.max(summary.maxLanes, 1), MAX_VISIBLE_LANES) * LANE_WIDTH_PX;
  const columns = layoutColumns(size.width, graphWidth);

  const pages = pagesFor(
    graphViewport.firstRow,
    Math.max(graphViewport.lastRow, 0),
    PAGE_ROWS,
    PREFETCH_MARGIN,
    Math.ceil(rowCount / PAGE_ROWS),
  );
  // The highlighted commit's text gives its author, also when it is scrolled out of view.
  if (highlight.row !== undefined) {
    const page = Math.floor(highlight.row / PAGE_ROWS);
    if (!pages.includes(page)) pages.push(page);
  }
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
      selectAny(repoPath, { kind: "commit", row: summary.headRow });
      const index = summary.headRow + rows.offset;
      element.scrollTop = scrollTopToReveal(index, 0, size.height, rows.count);
    }
    // Only when the view (re)appears with a measured size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.height > 0, repoPath]);

  // Keep the selection visible, also when another module selects a commit (a parent, a
  // branch). Skipped on mount so a remembered scroll position wins.
  const shownIndex = useRef(selectedIndex);
  useEffect(() => {
    const element = scrollRef.current;
    if (selectedIndex === shownIndex.current || selectedIndex === undefined || !element) return;
    shownIndex.current = selectedIndex;
    element.scrollTop = scrollTopToReveal(
      selectedIndex,
      element.scrollTop,
      size.height,
      rows.count,
    );
  }, [selectedIndex, size.height, rows.count]);

  const highlightAuthor =
    highlight.row === undefined ? undefined : rowText(highlight.row)?.authorEmail.toLowerCase();

  const choose = (index: number) => {
    const next: Selection | undefined = selectionAt(rows, index);
    if (!next) return;
    highlight.restore();
    selectAny(repoPath, next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && highlight.row !== undefined) {
      event.preventDefault();
      highlight.dismiss();
      return;
    }
    const page = Math.floor(size.height / ROW_HEIGHT_PX);
    const index = nextRow(event.key, selectedIndex, rows.count, page);
    if (index === null) return;
    event.preventDefault();
    choose(index);
  };

  const visible =
    selectedIndex !== undefined &&
    selectedIndex >= viewport.firstRow &&
    selectedIndex <= viewport.lastRow;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphHeader columns={columns} />
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={`Commit history, ${rowCount} commits`}
        aria-activedescendant={visible ? `${idPrefix}-${selectedIndex}` : undefined}
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          setScrollTop(top);
          useGraphViewStore.getState().rememberScroll(repoPath, top);
        }}
        onKeyDown={onKeyDown}
      >
        <div style={{ height: viewport.spacerHeight }}>
          {/* No taller than the spacer: while the pane shrinks, `size` is a frame late, and a
              taller layer would flash a scrollbar on short histories. */}
          <div
            className="sticky top-0 overflow-hidden"
            style={{ height: Math.min(size.height, viewport.spacerHeight) }}
          >
            <GraphRows
              firstIndex={viewport.firstRow}
              lastIndex={viewport.lastRow}
              virtualTop={viewport.virtualTop}
              rows={rows}
              columns={columns}
              rowText={rowText}
              selectedIndex={selectedIndex}
              highlightAuthor={highlightAuthor}
              onSelect={choose}
              idPrefix={idPrefix}
            />
            <GraphCanvas
              width={graphWidth}
              height={size.height}
              viewport={graphViewport}
              rowCount={rowCount}
              blockRows={summary.blockRows}
              cache={cache}
              version={version}
              palette={palette}
              highlight={highlight}
              workingTree={{ count: rows.offset, headRow: summary.headRow }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
