/**
 * Draws the working tree rows above the commits: a hollow node per row in HEAD's lane, joined
 * to each other and to the HEAD commit by a dashed line (they are not commits yet).
 */
import { LINE_WIDTH_PX, NODE_RADIUS_PX, ROW_HEIGHT_PX } from "./constants";
import { laneX, type DrawContext } from "./draw";

/** Dash pattern of the line from the working tree rows to HEAD. */
const DASH_PX = [3, 3];

export type WorkingTreeContext = DrawContext & Pick<CanvasRenderingContext2D, "setLineDash">;

export interface WorkingTreeDrawRequest {
  /** Number of working tree rows; they sit at graph rows `-count .. -1`. */
  count: number;
  /** Top of the window in graph row coordinates (negative while the rows are visible). */
  virtualTop: number;
  /** HEAD's row and lane, or undefined (unborn branch, or HEAD's block not loaded yet). */
  head: { row: number; lane: number } | undefined;
  color: string;
  background: string;
}

export function drawWorkingTree(ctx: WorkingTreeContext, request: WorkingTreeDrawRequest): void {
  const { count, virtualTop, head } = request;
  if (count === 0) return;
  const centerY = (row: number) => row * ROW_HEIGHT_PX - virtualTop + ROW_HEIGHT_PX / 2;
  const x = laneX(head?.lane ?? 0);
  const top = centerY(-count);

  ctx.strokeStyle = request.color;
  ctx.lineWidth = LINE_WIDTH_PX;
  ctx.setLineDash(DASH_PX);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, head ? centerY(head.row) : centerY(-1));
  ctx.stroke();
  ctx.setLineDash([]);

  for (let row = -count; row < 0; row += 1) {
    ctx.fillStyle = request.background;
    ctx.beginPath();
    ctx.arc(x, centerY(row), NODE_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, centerY(row), NODE_RADIUS_PX, 0, Math.PI * 2);
    ctx.stroke();
  }
}
