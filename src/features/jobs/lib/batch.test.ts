import { toast } from "sonner";

import type { JobDto } from "@/shared/ipc/bindings";

import { batchJobEnded, batchSummary, startBatch, type BatchResult } from "./batch";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function ended(id: number, repoPath: string, state: JobDto["state"], message: string): JobDto {
  return {
    id,
    kind: "pull",
    title: "Pull main",
    repoPath,
    command: "git pull",
    state,
    progress: null,
    message,
    logLines: 0,
    startedAt: 0,
    finishedAt: 1,
  };
}

describe("batches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts failures first and counts what does not fit", () => {
    const results: BatchResult[] = [
      ...["a", "b", "c", "d", "e", "f"].map((name) => ({
        path: `/r/${name}`,
        state: "succeeded" as const,
        message: "Already up to date",
      })),
      { path: "C:\\code\\web", state: "failed", message: "Pull first, then push.\nrejected" },
    ];
    expect(batchSummary("Push all in Work", results)).toEqual({
      title: "Push all in Work: 6 done, 1 failed",
      description: [
        "web: Pull first, then push.",
        "a: Already up to date",
        "b: Already up to date",
        "c: Already up to date",
        "d: Already up to date",
        "e: Already up to date",
        "and 1 more",
      ].join("\n"),
      failed: true,
    });
  });

  it("toasts once, when the last job of the batch ends, counting jobs that could not start", async () => {
    startBatch("Pull all in Work", [
      { path: "/r/api", start: () => Promise.resolve(41) },
      {
        path: "/r/gone",
        start: () => Promise.reject(new Error("not a repository")),
      },
      { path: "/r/web", start: () => Promise.resolve(42) },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(batchJobEnded(ended(41, "/r/api", "succeeded", "Fast-forwarded"))).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    expect(batchJobEnded(ended(42, "/r/web", "succeeded", "Already up to date"))).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      "Pull all in Work: 2 done, 1 failed",
      expect.objectContaining({
        description: "gone: not a repository\napi: Fast-forwarded\nweb: Already up to date",
      }),
    );
    // A job of no batch is announced on its own.
    expect(batchJobEnded(ended(43, "/r/api", "succeeded", ""))).toBe(false);
  });
});
