import type { JobDto } from "@/shared/ipc/bindings";

import { afterJob, jobEnded } from "./followUp";

function ended(id: number): JobDto {
  return { id, state: "succeeded", repoPath: "C:\\code\\app" } as JobDto;
}

describe("following a job up", () => {
  it("runs once the job ends, also when the end came before the request", () => {
    const later = vi.fn();
    afterJob(1, later);
    expect(later).not.toHaveBeenCalled();
    jobEnded(ended(1));
    expect(later).toHaveBeenCalledWith(ended(1));
    jobEnded(ended(1));
    expect(later).toHaveBeenCalledTimes(1);

    // A clone refused at once: its end arrives before its id.
    jobEnded(ended(2));
    const early = vi.fn();
    afterJob(2, early);
    expect(early).toHaveBeenCalledWith(ended(2));
  });
});
