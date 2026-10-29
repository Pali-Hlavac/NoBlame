import { useState, type RefObject, type UIEvent } from "react";

import { useElementSize } from "@/shared/hooks/useElementSize";
import { pagesFor } from "@/shared/lib/paging";

import { DIFF_PAGE_ROWS, OVERSCAN_ROWS, PREFETCH_PAGES, ROW_HEIGHT_PX } from "../lib/constants";

/**
 * The rows of a fixed-height virtual list that are on screen (plus overscan), and the pages of
 * {@link DIFF_PAGE_ROWS} rows to fetch for them. Attach `onScroll` to the scrolling element.
 */
export function useVirtualRows(scrollRef: RefObject<HTMLDivElement | null>, count: number) {
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(0);
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
  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    setScrollTop(event.currentTarget.scrollTop);
  };
  return { first, last, pages, onScroll };
}

/** The row at `index` from page results fetched for `pages`. */
export function rowAt<T>(
  results: readonly { data?: readonly T[] | undefined }[],
  pages: readonly number[],
  index: number,
): T | undefined {
  return results[pages.indexOf(Math.floor(index / DIFF_PAGE_ROWS))]?.data?.[index % DIFF_PAGE_ROWS];
}
