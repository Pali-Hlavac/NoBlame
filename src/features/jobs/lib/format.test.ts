import { describe, expect, it } from "vitest";

import type { JobDto } from "@/shared/ipc/bindings";

import { durationLabel, progressLabel, repositoryName } from "./format";

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: 1,
    kind: "fetch",
    title: "Fetch",
    repoPath: "C:\\code\\app",
    command: "git fetch --progress",
    state: "running",
    progress: null,
    message: null,
    logLines: 0,
    startedAt: 100,
    finishedAt: null,
    ...overrides,
  };
}

describe("jobs format", () => {
  it("names the repository by its folder", () => {
    expect(repositoryName("C:\\code\\app\\")).toBe("app");
    expect(repositoryName("/home/me/linux")).toBe("linux");
  });

  it("describes progress", () => {
    expect(progressLabel(job())).toBe("Starting…");
    expect(
      progressLabel(
        job({ progress: { phase: "Receiving objects", percent: 45, detail: "1 MiB" } }),
      ),
    ).toBe("Receiving objects 45%");
    expect(
      progressLabel(job({ progress: { phase: "Remote: Counting", percent: null, detail: "" } })),
    ).toBe("Remote: Counting");
  });

  it("measures time, finished or not", () => {
    expect(durationLabel(job({ finishedAt: 100.42 }), 999)).toBe("0.4 s");
    expect(durationLabel(job(), 130)).toBe("30 s");
    expect(durationLabel(job(), 285)).toBe("3 min 5 s");
  });
});
