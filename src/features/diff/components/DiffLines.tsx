import { useContext, type RefObject } from "react";

import { InlineError } from "@/shared/components/InlineError";
import type { DiffLayout, FileDiffDto } from "@/shared/ipc/bindings";

import { useDiffPages, type DiffRequest } from "../api/diff";
import { LineStagingContext, clickLine } from "../hooks/useLineStaging";
import { rowAt, useVirtualRows } from "../hooks/useVirtualRows";
import { MAX_SHOWN_ROWS, ROW_HEIGHT_PX } from "../lib/constants";
import { gutterDigits } from "../lib/format";
import { keyOfRow, type LineKey } from "../lib/lineSelection";
import { REGION_CLASSES, type LinesProps } from "../lib/region";
import { DiffRow } from "./DiffRow";
import { SplitLines } from "./SplitLines";

const counts = new Intl.NumberFormat("en-US");

/** The unified diff: one column with both line numbers; long lines scroll sideways. */
function UnifiedLines({ request, diff, count, label, viewport, scrollTop }: LinesProps) {
  const { first, last, pages, onScroll } = useVirtualRows(viewport, count, scrollTop);
  const results = useDiffPages(request, pages);
  const failed = results.find((result) => result.error)?.error;
  const digits = gutterDigits(diff.oldLines, diff.newLines);
  const staging = useContext(LineStagingContext);
  const keysOfRow = (index: number): LineKey[] => {
    const key = keyOfRow(rowAt(results, pages, index));
    return key ? [key] : [];
  };

  const rows = [];
  for (let index = first; index <= last; index++) {
    const line = rowAt(results, pages, index);
    const key = keyOfRow(line);
    const choice =
      staging && key
        ? {
            selected: staging.selected.has(key),
            onClick: (extend: boolean) => {
              clickLine(staging, index, key, extend, keysOfRow);
            },
          }
        : undefined;
    rows.push(
      <div
        key={index}
        className="absolute left-0 min-w-full"
        style={{ top: index * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        <DiffRow line={line} digits={digits} choice={choice} />
      </div>,
    );
  }

  return (
    <>
      {failed !== undefined && <InlineError error={failed} className="m-2" />}
      <div
        ref={viewport}
        role="region"
        aria-label={label}
        // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={`${REGION_CLASSES} overflow-auto`}
        onScroll={onScroll}
      >
        <div style={{ height: count * ROW_HEIGHT_PX }}>{rows}</div>
      </div>
    </>
  );
}

interface DiffLinesProps {
  request: DiffRequest;
  diff: FileDiffDto;
  layout: DiffLayout;
  label: string;
  viewport: RefObject<HTMLDivElement | null>;
  scrollTop: number;
}

/**
 * The diff, virtualized: only the rows on screen are rendered, and their text is fetched in
 * pages. Focus it to scroll with the keyboard.
 */
export function DiffLines({ layout, ...rest }: DiffLinesProps) {
  const total = layout === "split" ? rest.diff.splitRows : rest.diff.rows;
  const count = Math.min(total, MAX_SHOWN_ROWS);
  const props = { ...rest, count };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {layout === "split" ? <SplitLines {...props} /> : <UnifiedLines {...props} />}
      {total > count && (
        <p className="shrink-0 border-t border-border px-3 py-1 text-xs text-muted-foreground">
          Showing the first {counts.format(count)} of {counts.format(total)} rows.
        </p>
      )}
    </div>
  );
}
