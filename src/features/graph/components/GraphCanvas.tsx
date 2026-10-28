import { useLayoutEffect, useRef } from "react";

import type { BlockCache } from "../lib/blockCache";
import type { AncestryBlock } from "../lib/decodeAncestry";
import { PREFETCH_MARGIN } from "../lib/constants";
import { drawGraph, type GraphPalette } from "../lib/draw";
import { drawWorkingTree } from "../lib/drawWorkingTree";
import type { Viewport } from "../lib/viewport";

interface GraphCanvasProps {
  width: number;
  height: number;
  /** Visible rows in graph coordinates (working tree rows are rows -1, -2 above row 0). */
  viewport: Viewport;
  rowCount: number;
  blockRows: number;
  cache: BlockCache;
  /** Changes whenever a block arrives, to trigger a redraw. */
  version: number;
  palette: GraphPalette;
  /** History of the highlighted row (none when `row` is undefined); dims everything else. */
  highlight?: { row: number | undefined; cache?: BlockCache<AncestryBlock>; version: number };
  /** Working tree rows above the commits, joined to the HEAD commit. */
  workingTree: { count: number; headRow: number | null };
}

/** The lanes column: a HiDPI canvas redrawn for the visible rows only. */
export function GraphCanvas(props: GraphCanvasProps) {
  const { width, height, viewport, rowCount, blockRows, cache, version, palette } = props;
  const highlightRow = props.highlight?.row;
  const overlays = props.highlight?.cache;
  const overlayVersion = props.highlight?.version;
  const { count: workingRows, headRow } = props.workingTree;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || width === 0 || height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGraph(ctx, {
      width,
      height,
      virtualTop: viewport.virtualTop,
      firstRow: viewport.firstRow,
      lastRow: viewport.lastRow,
      rowCount,
      blockRows,
      getBlock: (block) => cache.get(block),
      palette,
      highlight:
        highlightRow === undefined ? undefined : { getOverlay: (block) => overlays?.get(block) },
    });
    if (workingRows > 0) {
      const headBlock = headRow === null ? undefined : Math.floor(headRow / blockRows);
      const block = headBlock === undefined ? undefined : cache.get(headBlock);
      if (headBlock !== undefined && !block) cache.request(headBlock);
      const lane = block && headRow !== null ? block.lanes[headRow - block.firstRow] : undefined;
      drawWorkingTree(ctx, {
        count: workingRows,
        virtualTop: viewport.virtualTop,
        head: headRow !== null && lane !== undefined ? { row: headRow, lane } : undefined,
        color: palette.muted,
        background: palette.background,
      });
    }
    // Load what is visible first, then the margin above and below.
    const firstBlock = Math.floor(viewport.firstRow / blockRows);
    const lastBlock = Math.floor(Math.max(viewport.lastRow + 1, 0) / blockRows);
    for (let block = firstBlock; block <= lastBlock; block += 1) cache.request(block);
    // Overlays exist from the highlighted row's block down; above it everything is dimmed.
    if (highlightRow !== undefined && overlays) {
      const from = Math.max(firstBlock, Math.floor(highlightRow / blockRows));
      for (let block = from; block <= lastBlock; block += 1) overlays.request(block);
    }
    const blockCount = Math.ceil(rowCount / blockRows);
    for (let step = 1; step <= PREFETCH_MARGIN; step += 1) {
      if (lastBlock + step < blockCount) cache.request(lastBlock + step);
      if (firstBlock - step >= 0) cache.request(firstBlock - step);
    }
  }, [
    width,
    height,
    viewport,
    rowCount,
    blockRows,
    cache,
    version,
    palette,
    highlightRow,
    overlays,
    overlayVersion,
    workingRows,
    headRow,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      style={{ width, height }}
    />
  );
}
