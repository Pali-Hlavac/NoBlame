import { DIMMED_ALPHA, FLAG_HEAD, FLAG_MERGE, ROW_HEIGHT_PX } from "./constants";
import type { GraphBlock } from "./decode";
import { drawGraph, laneX, type DrawContext, type Highlight } from "./draw";

/** A context that records the calls the renderer makes. */
function recordingContext() {
  const calls: string[] = [];
  const ctx: DrawContext = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    clearRect: () => calls.push("clear"),
    beginPath: () => calls.push("begin"),
    moveTo: (x, y) => calls.push(`move ${x} ${y}`),
    lineTo: (x, y) => calls.push(`line ${x} ${y}`),
    bezierCurveTo: () => calls.push("curve"),
    stroke: () => calls.push(`stroke ${String(ctx.strokeStyle)}${alpha()}`),
    fill: () => calls.push(`fill ${String(ctx.fillStyle)}${alpha()}`),
    arc: () => calls.push("arc"),
  };
  // Recorded only when dimmed, so plain drawing reads as before.
  const alpha = () => (ctx.globalAlpha === 1 ? "" : ` ${ctx.globalAlpha}`);
  return { ctx, calls };
}

/** Rows: a merge on lane 0, then a commit on lane 1 reached by a curve from lane 0. */
const block: GraphBlock = {
  firstRow: 0,
  count: 2,
  lanes: Uint16Array.from([0, 1]),
  colors: Uint16Array.from([0, 1]),
  flags: Uint8Array.from([FLAG_MERGE | FLAG_HEAD, 0]),
  edgeStart: Uint32Array.from([0, 0, 2]),
  edges: Uint16Array.from([0, 0, 0, 0, 1, 1]),
};

const palette = { lanes: ["red", "blue"], background: "white", head: "gold", muted: "grey" };

function draw(getBlock: (index: number) => GraphBlock | undefined, highlight?: Highlight) {
  const { ctx, calls } = recordingContext();
  const missing = drawGraph(ctx, {
    width: 100,
    height: 2 * ROW_HEIGHT_PX,
    virtualTop: 0,
    firstRow: 0,
    lastRow: 1,
    rowCount: 2,
    blockRows: 256,
    getBlock,
    palette,
    highlight,
  });
  return { calls, missing };
}

describe("drawGraph", () => {
  it("strokes once per colour and curves lines that change lane", () => {
    const { calls } = draw(() => block);
    expect(calls.filter((call) => call.startsWith("stroke"))).toEqual([
      "stroke red",
      "stroke blue",
    ]);
    expect(calls.filter((call) => call === "curve")).toHaveLength(1);
    expect(calls).toContain(`line ${laneX(0)} ${ROW_HEIGHT_PX * 1.5}`);
  });

  it("draws HEAD with a ring and merges as hollow nodes", () => {
    const { calls } = draw(() => block);
    const fills = calls.filter((call) => call.startsWith("fill"));
    expect(fills).toEqual(["fill gold", "fill red", "fill white", "fill blue"]);
  });

  it("dims what is outside the highlighted history", () => {
    // Row 0 and the straight line into row 1 are in the history; row 1 and its curve are not.
    const overlay = {
      firstRow: 0,
      count: 2,
      rows: Uint8Array.from([1, 0]),
      edges: Uint8Array.from([1, 0]),
    };
    const { calls } = draw(() => block, { getOverlay: () => overlay });
    expect(calls.filter((call) => call.startsWith("stroke"))).toEqual([
      "stroke red",
      `stroke blue ${DIMMED_ALPHA}`,
    ]);
    expect(calls.filter((call) => call.startsWith("fill"))).toEqual([
      "fill gold",
      "fill red",
      "fill white",
      `fill blue ${DIMMED_ALPHA}`,
    ]);
  });

  it("dims everything while the overlay is loading", () => {
    const { calls } = draw(() => block, { getOverlay: () => undefined });
    expect(calls.filter((call) => call.startsWith("stroke"))).toEqual([
      `stroke red ${DIMMED_ALPHA}`,
      `stroke blue ${DIMMED_ALPHA}`,
    ]);
  });

  it("reports blocks that are not loaded yet", () => {
    const { calls, missing } = draw(() => undefined);
    expect(missing).toEqual([0]);
    expect(calls).toEqual(["clear"]);
  });
});
