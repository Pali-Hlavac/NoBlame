/**
 * Draws the visible part of the graph onto a 2D canvas context. Pure apart from the context,
 * so it is unit-tested with a recording fake. Lines are batched per colour (one stroke each).
 */
import {
  FLAG_HEAD,
  FLAG_MERGE,
  GRAPH_PADDING_PX,
  LANE_WIDTH_PX,
  LINE_WIDTH_PX,
  NODE_RADIUS_PX,
  ROW_HEIGHT_PX,
} from "./constants";
import type { GraphBlock } from "./decode";

/** Colours read from CSS tokens (see `src/app/styles.css`). */
export interface GraphPalette {
  lanes: readonly string[];
  /** Fill of merge nodes (the background), so they read as hollow. */
  background: string;
  /** Ring around the HEAD commit. */
  head: string;
}

/** The subset of `CanvasRenderingContext2D` the renderer uses. */
export type DrawContext = Pick<
  CanvasRenderingContext2D,
  "clearRect" | "beginPath" | "moveTo" | "lineTo" | "bezierCurveTo" | "stroke" | "fill" | "arc"
> & { strokeStyle: unknown; fillStyle: unknown; lineWidth: number };

export interface DrawRequest {
  width: number;
  height: number;
  /** Top of the window in row coordinates. */
  virtualTop: number;
  firstRow: number;
  lastRow: number;
  rowCount: number;
  blockRows: number;
  getBlock: (block: number) => GraphBlock | undefined;
  palette: GraphPalette;
}

export function laneX(lane: number): number {
  return GRAPH_PADDING_PX + lane * LANE_WIDTH_PX + LANE_WIDTH_PX / 2;
}

/** Draws rows `firstRow..=lastRow` plus the lines entering from the rows around them. */
export function drawGraph(ctx: DrawContext, request: DrawRequest): number[] {
  const { firstRow, lastRow, rowCount, virtualTop, palette } = request;
  ctx.clearRect(0, 0, request.width, request.height);
  const missing = new Set<number>();
  const rowAt = (row: number) => {
    const blockIndex = Math.floor(row / request.blockRows);
    const block = request.getBlock(blockIndex);
    if (!block) missing.add(blockIndex);
    return block ? { block, offset: row - block.firstRow } : undefined;
  };
  const centerY = (row: number) => row * ROW_HEIGHT_PX - virtualTop + ROW_HEIGHT_PX / 2;
  const colour = (id: number) => palette.lanes[id % palette.lanes.length] ?? "currentColor";

  // Lines: each row stores the lines arriving from the row above, so include the next row.
  const byColour = new Map<number, number[]>();
  const lastLineRow = Math.min(lastRow + 1, rowCount - 1);
  for (let row = firstRow; row <= lastLineRow; row += 1) {
    const found = rowAt(row);
    if (!found) continue;
    const { block, offset } = found;
    for (
      let edge = block.edgeStart[offset] ?? 0;
      edge < (block.edgeStart[offset + 1] ?? 0);
      edge += 1
    ) {
      const color = block.edges[edge * 3 + 2] ?? 0;
      const list = byColour.get(color) ?? [];
      list.push(block.edges[edge * 3] ?? 0, block.edges[edge * 3 + 1] ?? 0, row);
      byColour.set(color, list);
    }
  }
  ctx.lineWidth = LINE_WIDTH_PX;
  for (const [color, segments] of byColour) {
    ctx.strokeStyle = colour(color);
    ctx.beginPath();
    for (let index = 0; index < segments.length; index += 3) {
      const [from = 0, to = 0, row = 0] = segments.slice(index, index + 3);
      const x1 = laneX(from);
      const x2 = laneX(to);
      const y1 = centerY(row - 1);
      const y2 = centerY(row);
      ctx.moveTo(x1, y1);
      if (from === to) {
        ctx.lineTo(x2, y2);
      } else {
        const middle = (y1 + y2) / 2;
        ctx.bezierCurveTo(x1, middle, x2, middle, x2, y2);
      }
    }
    ctx.stroke();
  }

  // Nodes on top of the lines.
  for (let row = firstRow; row <= lastRow; row += 1) {
    const found = rowAt(row);
    if (!found) continue;
    const { block, offset } = found;
    const x = laneX(block.lanes[offset] ?? 0);
    const y = centerY(row);
    const flags = block.flags[offset] ?? 0;
    const fill = colour(block.colors[offset] ?? 0);
    if (flags & FLAG_HEAD) {
      ctx.fillStyle = palette.head;
      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS_PX + 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    if (flags & FLAG_MERGE) {
      ctx.fillStyle = palette.background;
      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS_PX - LINE_WIDTH_PX, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return [...missing];
}
