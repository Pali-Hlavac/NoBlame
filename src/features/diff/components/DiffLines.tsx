import { useRef, useState } from "react";

import { InlineError } from "@/shared/components/InlineError";
import type { FileDiffDto } from "@/shared/ipc/bindings";
import { useElementSize } from "@/shared/hooks/useElementSize";
import { pagesFor } from "@/shared/lib/paging";

import { useDiffPages } from "../api/diff";
import {
  DIFF_PAGE_ROWS,
  MAX_SHOWN_ROWS,
  OVERSCAN_ROWS,
  PREFETCH_PAGES,
  ROW_HEIGHT_PX,
} from "../lib/constants";
import { gutterDigits } from "../lib/format";
import { DiffRow } from "./DiffRow";

const counts = new Intl.NumberFormat("en-US");

interface DiffLinesProps {
  repoId: number;
  oldId: string | null;
  newId: string | null;
  diff: FileDiffDto;
  /** Accessible name of the scrolling region, e.g. "Diff of src/main.rs". */
  label: string;
}

/**
 * The unified diff, virtualized: only the rows on screen are rendered, and their text is
 * fetched in pages of {@link DIFF_PAGE_ROWS}. Focus it to scroll with the keyboard.
 */
export function DiffLines({ repoId, oldId, newId, diff, label }: DiffLinesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(0);

  const count = Math.min(diff.rows, MAX_SHOWN_ROWS);
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
  const last = Math.min(
    count - 1,
    Math.ceil((scrollTop + size.height) / ROW_HEIGHT_PX) + OVERSCAN_ROWS,
  );
  const pages = pagesFor(
    first,
    last,
    DIFF_PAGE_ROWS,
    PREFETCH_PAGES,
    Math.ceil(count / DIFF_PAGE_ROWS),
  );
  const results = useDiffPages(repoId, oldId, newId, pages);
  const failed = results.find((result) => result.error)?.error;
  const digits = gutterDigits(diff.oldLines, diff.newLines);

  const rows = [];
  for (let index = first; index <= last; index++) {
    const page = results[pages.indexOf(Math.floor(index / DIFF_PAGE_ROWS))];
    rows.push(
      <div
        key={index}
        className="absolute left-0 min-w-full"
        style={{ top: index * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        <DiffRow line={page?.data?.[index % DIFF_PAGE_ROWS]} digits={digits} />
      </div>,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {failed !== undefined && <InlineError error={failed} className="m-2" />}
      <div
        ref={scrollRef}
        role="region"
        aria-label={label}
        // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-auto font-mono text-xs leading-5 [tab-size:4] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
      >
        <div style={{ height: count * ROW_HEIGHT_PX }}>{rows}</div>
      </div>
      {diff.rows > count && (
        <p className="shrink-0 border-t border-border px-3 py-1 text-xs text-muted-foreground">
          Showing the first {counts.format(count)} of {counts.format(diff.rows)} rows.
        </p>
      )}
    </div>
  );
}
