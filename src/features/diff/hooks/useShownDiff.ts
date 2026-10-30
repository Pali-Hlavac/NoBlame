import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useState, type RefObject } from "react";

import type { DiffLayout, FileDiffDto } from "@/shared/ipc/bindings";
import { pagesFor } from "@/shared/lib/paging";

import {
  diffKeys,
  findDiffRow,
  splitPageQuery,
  unifiedPageQuery,
  useFileDiff,
  type DiffRequest,
} from "../api/diff";
import { anchorAt, scrollTopFor } from "../lib/anchor";
import { DIFF_PAGE_ROWS, MAX_SHOWN_ROWS, ROW_HEIGHT_PX } from "../lib/constants";

/** The diff on screen: what was asked, its summary, and where its rows start scrolled. */
export interface ShownDiff {
  request: DiffRequest;
  layout: DiffLayout;
  diff: FileDiffDto;
  scrollTop: number;
}

/** Identifies a diff and its layout (one string, for keys and comparisons). */
export function viewKey(request: DiffRequest, layout: DiffLayout): string {
  return JSON.stringify([...diffKeys.summary(request), layout]);
}

function sameFile(a: DiffRequest, b: DiffRequest): boolean {
  return a.repoId === b.repoId && a.oldId === b.oldId && a.newId === b.newId && a.path === b.path;
}

/** Row `index` of the shown diff, if its page is in the cache. */
function cachedRow(client: QueryClient, shown: ShownDiff, index: number) {
  const page = Math.floor(index / DIFF_PAGE_ROWS);
  const rows =
    shown.layout === "split"
      ? client.getQueryData(splitPageQuery(shown.request, page).queryKey)
      : client.getQueryData(unifiedPageQuery(shown.request, page).queryKey);
  return rows?.[index % DIFF_PAGE_ROWS];
}

/** Fetches the rows of `request` a view scrolled to `top` shows, so they appear at once. */
async function prefetchRows(
  client: QueryClient,
  request: DiffRequest,
  layout: DiffLayout,
  diff: FileDiffDto,
  top: number,
  height: number,
): Promise<void> {
  const total = layout === "split" ? diff.splitRows : diff.rows;
  const first = Math.floor(top / ROW_HEIGHT_PX);
  const last = Math.ceil((top + height) / ROW_HEIGHT_PX);
  const pages = pagesFor(first, last, DIFF_PAGE_ROWS, 0, Math.ceil(total / DIFF_PAGE_ROWS));
  await Promise.all(
    pages.map(async (page) => {
      try {
        if (layout === "split") await client.query(splitPageQuery(request, page));
        else await client.query(unifiedPageQuery(request, page));
      } catch {
        // The view asks again and shows the error.
      }
    }),
  );
}

/**
 * Where the rows of `request` should start so the line in the middle of the shown diff stays
 * where it is on screen; 0 for another file or when that line is not known.
 */
async function placeOf(
  client: QueryClient,
  shown: ShownDiff | null,
  viewport: HTMLElement | null,
  request: DiffRequest,
  layout: DiffLayout,
  diff: FileDiffDto,
): Promise<number> {
  if (!shown || !viewport || !sameFile(shown.request, request)) return 0;
  const count = shown.layout === "split" ? shown.diff.splitRows : shown.diff.rows;
  const { scrollTop, clientHeight } = viewport;
  const anchor = anchorAt(
    (index) => cachedRow(client, shown, index),
    scrollTop,
    clientHeight,
    count,
  );
  if (!anchor) return 0;
  const row = await findDiffRow(request, layout, anchor.side, anchor.line);
  if (row === null) return 0;
  // Near the end the view cannot scroll that far; the rows it then shows are fetched.
  const rows = Math.min(layout === "split" ? diff.splitRows : diff.rows, MAX_SHOWN_ROWS);
  const top = Math.min(scrollTopFor(row, anchor), Math.max(0, rows * ROW_HEIGHT_PX - clientHeight));
  await prefetchRows(client, request, layout, diff, top, clientHeight);
  return top;
}

/**
 * The diff to show for `request` in `layout`. When only the options or the layout change, the
 * previous diff stays on screen (`pending`, for an overlay) until the new one is ready, and the
 * new one opens at the line that was in the middle. `viewport` is the scrolling element.
 */
export function useShownDiff(
  request: DiffRequest,
  layout: DiffLayout,
  viewport: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const client = useQueryClient();
  const summary = useFileDiff(request, enabled);
  const [shown, setShown] = useState<ShownDiff | null>(null);
  const key = viewKey(request, layout);
  const target = summary.data;

  const place = useEffectEvent(async (diff: FileDiffDto): Promise<ShownDiff | null> => {
    if (shown?.diff === diff && viewKey(shown.request, shown.layout) === key) return null;
    const scrollTop = await placeOf(client, shown, viewport.current, request, layout, diff).catch(
      () => 0,
    );
    return { request, layout, diff, scrollTop };
  });

  useEffect(() => {
    if (!target) return;
    let live = true;
    void place(target).then((next) => {
      if (live && next) setShown(next);
    });
    return () => {
      live = false;
    };
  }, [key, target]);

  // A diff of another file is not shown while this one loads.
  const current = shown && sameFile(shown.request, request) ? shown : null;
  return {
    shown: current,
    pending: current === null || viewKey(current.request, current.layout) !== key,
    summary,
  };
}
