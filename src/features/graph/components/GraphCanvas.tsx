import { useLayoutEffect, useRef } from "react";

import type { BlockCache } from "../lib/blockCache";
import type { AncestryBlock } from "../lib/decodeAncestry";
import { PREFETCH_MARGIN } from "../lib/constants";
import { drawGraph, type GraphPalette } from "../lib/draw";
import type { Viewport } from "../lib/viewport";

interface GraphCanvasProps {
  width: number;
  height: number;
  viewport: Viewport;
  rowCount: number;
  blockRows: number;
  cache: BlockCache;
  /** Changes whenever a block arrives, to trigger a redraw. */
  version: number;
  palette: GraphPalette;
  /** History of the highlighted row (none when `row` is undefined); dims everything else. */
  highlight?: { row: number | undefined; cache?: BlockCache<AncestryBlock>; version: number };
}

/** The lanes column: a HiDPI canvas redrawn for the visible rows only. */
export function GraphCanvas(props: GraphCanvasProps) {
  const { width, height, viewport, rowCount, blockRows, cache, version, palette } = props;
  const highlightRow = props.highlight?.row;
  const overlays = props.highlight?.cache;
  const overlayVersion = props.highlight?.version;
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
