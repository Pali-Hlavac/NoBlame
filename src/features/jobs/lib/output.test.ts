import type { JobDto } from "@/shared/ipc/bindings";

import { EMPTY_OUTPUT, appendOutput, progressLine } from "./output";

describe("job output", () => {
  it("adds only what is new, and says when lines were dropped in between", () => {
    const first = appendOutput(EMPTY_OUTPUT, { from: 0, lines: ["a", "b"] });
    expect(first).toEqual({ next: 2, lines: ["a", "b"] });
    expect(appendOutput(first, { from: 2, lines: ["c"] })).toEqual({
      next: 3,
      lines: ["a", "b", "c"],
    });
    expect(appendOutput(first, { from: 9, lines: ["j"] })).toEqual({
      next: 10,
      lines: ["a", "b", "… 7 lines left out (only the newest are kept)", "j"],
    });
  });

  it("writes the progress line as git does", () => {
    const job = {
      progress: { phase: "Receiving objects", percent: 45, detail: "(450/1000), 1.2 MiB" },
    } as JobDto;
    expect(progressLine(job)).toBe("Receiving objects: 45% (450/1000), 1.2 MiB");
    expect(progressLine({ progress: null } as JobDto)).toBeNull();
  });
});
