import { ROW_HEIGHT_PX } from "./constants";
import { laneX } from "./draw";
import { drawWorkingTree, type WorkingTreeContext } from "./drawWorkingTree";

function recordingContext() {
  const calls: string[] = [];
  const ctx: WorkingTreeContext = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    clearRect: () => calls.push("clear"),
    beginPath: () => calls.push("begin"),
    moveTo: (x, y) => calls.push(`move ${x} ${y}`),
    lineTo: (x, y) => calls.push(`line ${x} ${y}`),
    bezierCurveTo: () => calls.push("curve"),
    stroke: () => calls.push("stroke"),
    fill: () => calls.push("fill"),
    arc: (x, y) => calls.push(`arc ${x} ${y}`),
    setLineDash: (dash) => calls.push(`dash ${[...dash].join(",")}`),
  };
  return { ctx, calls };
}

const base = { color: "grey", background: "white" };

describe("drawWorkingTree", () => {
  it("draws nothing without working tree rows", () => {
    const { ctx, calls } = recordingContext();
    drawWorkingTree(ctx, { ...base, count: 0, virtualTop: 0, head: undefined });
    expect(calls).toEqual([]);
  });

  it("joins the rows to HEAD with a dashed line in HEAD's lane", () => {
    const { ctx, calls } = recordingContext();
    // Two rows above the commits, scrolled to the very top, HEAD on row 0 in lane 2.
    drawWorkingTree(ctx, {
      ...base,
      count: 2,
      virtualTop: -2 * ROW_HEIGHT_PX,
      head: { row: 0, lane: 2 },
    });
    const x = laneX(2);
    const half = ROW_HEIGHT_PX / 2;
    expect(calls.slice(0, 5)).toEqual([
      "dash 3,3",
      "begin",
      `move ${x} ${half}`,
      `line ${x} ${2 * ROW_HEIGHT_PX + half}`,
      "stroke",
    ]);
    expect(calls.filter((call) => call.startsWith("arc"))).toEqual([
      `arc ${x} ${half}`,
      `arc ${x} ${half}`,
      `arc ${x} ${ROW_HEIGHT_PX + half}`,
      `arc ${x} ${ROW_HEIGHT_PX + half}`,
    ]);
  });
});
