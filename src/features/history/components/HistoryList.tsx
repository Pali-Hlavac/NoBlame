import { useCallback, useState } from "react";

import { formatCommitDate } from "@/features/graph";
import { selectFile, selectRow, useSelectedRow } from "@/features/selection";
import { showDiffTab } from "@/features/workspace";
import { VirtualList } from "@/shared/components/VirtualList";
import { pagesFor } from "@/shared/lib/paging";

import { HISTORY_PAGE_ROWS, useHistoryPages } from "../api/history";
import { describeEntry, entryAt, indexOfRow } from "../lib/rows";
import type { HistoryTarget } from "../store/history";
import { HistoryRow } from "./HistoryRow";

const ROW_HEIGHT_PX = 26;
/** Pages fetched beyond the rows on screen, each way. */
const PREFETCH_PAGES = 1;

interface HistoryListProps {
  repoId: number;
  repoPath: string;
  target: HistoryTarget;
  total: number;
  /** The graph generation the rows of the commits belong to. */
  generation: number;
}

/**
 * The commits of a history, newest first, fetched a page at a time. Moving onto a commit
 * selects it in the graph; for a file, Changed files chooses the file (under the name it had
 * there) and the diff tab shows its change. A commit selected elsewhere moves the cursor.
 */
export function HistoryList({ repoId, repoPath, target, total, generation }: HistoryListProps) {
  const [range, setRange] = useState({ first: 0, last: 0 });
  const onRangeChange = useCallback((first: number, last: number) => {
    setRange({ first, last });
  }, []);
  const pageCount = Math.ceil(total / HISTORY_PAGE_ROWS);
  const pages = pagesFor(range.first, range.last, HISTORY_PAGE_ROWS, PREFETCH_PAGES, pageCount);
  const results = useHistoryPages(repoId, target.path, generation, pages);

  // The cursor follows selections made elsewhere (the graph, Commit details).
  const selectedIndex = indexOfRow(results, pages, useSelectedRow(repoPath));
  const [cursor, setCursor] = useState(selectedIndex);
  const [followed, setFollowed] = useState(selectedIndex);
  if (selectedIndex !== followed) {
    setFollowed(selectedIndex);
    if (selectedIndex !== undefined) setCursor(selectedIndex);
  }

  const choose = (index: number): void => {
    setCursor(index);
    const entry = entryAt(results, pages, index);
    const row = entry?.row ?? null;
    if (!entry || row === null) return;
    selectRow(repoPath, row);
    if (target.folder) return;
    selectFile(repoPath, entry.path);
    showDiffTab();
  };

  return (
    <VirtualList
      className="flex-1"
      label={`History of ${target.path}`}
      count={total}
      rowHeight={ROW_HEIGHT_PX}
      activeIndex={cursor}
      onActiveChange={choose}
      onActivate={choose}
      onRangeChange={onRangeChange}
      rowLabel={(index) => {
        const entry = entryAt(results, pages, index);
        return entry ? describeEntry(entry, formatCommitDate(entry.authorTime)) : "Loading";
      }}
      renderRow={(index, active) => (
        <HistoryRow entry={entryAt(results, pages, index)} path={target.path} active={active} />
      )}
    />
  );
}
