import { toast } from "sonner";

import type { JobDto } from "@/shared/ipc/bindings";

import { trackJob } from "./start";
import { bindJobToast, showJobProgress, takeJobToast } from "./toasts";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => "starting"),
    dismiss: vi.fn(),
  }),
}));

function job(id: number, overrides: Partial<JobDto> = {}): JobDto {
  return {
    id,
    kind: "fetch",
    title: "Fetch origin",
    repoPath: "C:\\code\\app",
    command: "git fetch --progress origin",
    state: "running",
    progress: { phase: "Receiving objects", percent: 45, detail: "" },
    message: null,
    logLines: 1,
    startedAt: 0,
    finishedAt: null,
    ...overrides,
  };
}

describe("a job's toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appears at once, follows the job's progress and is replaced by its end", async () => {
    let started: (id: number) => void = () => undefined;
    void trackJob(
      new Promise<number>((resolve) => {
        started = resolve;
      }),
      "fetch",
    );
    expect(toast.loading).toHaveBeenCalledWith("Fetching…");

    // Progress that came before the job's id is shown once the id is known.
    showJobProgress(job(1));
    expect(toast.loading).toHaveBeenCalledTimes(1);
    started(1);
    await Promise.resolve();
    expect(toast.loading).toHaveBeenLastCalledWith(
      "Fetch origin",
      expect.objectContaining({ id: "starting" }),
    );
    const options = vi.mocked(toast.loading).mock.lastCall?.[1];
    expect(options?.action).toMatchObject({ label: "Cancel" });
    expect(takeJobToast(1)).toBe("starting");
    expect(toast.dismiss).not.toHaveBeenCalled();
  });

  it("goes when the job ended (in a toast of its own) before its id came", () => {
    expect(takeJobToast(2)).toBeUndefined();
    bindJobToast(2, "starting");
    expect(toast.dismiss).toHaveBeenCalledWith("starting");
    showJobProgress(job(2));
    expect(toast.loading).not.toHaveBeenCalled();
  });

  it("goes when the job could not start", async () => {
    await expect(trackJob(Promise.reject(new Error("no")), "push")).rejects.toThrow("no");
    expect(toast.loading).toHaveBeenCalledWith("Pushing…");
    expect(toast.dismiss).toHaveBeenCalledWith("starting");
  });
});
