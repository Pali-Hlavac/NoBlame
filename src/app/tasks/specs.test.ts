import type { RepoSummary } from "@/shared/ipc/bindings";

import { TASK_SPECS, type TaskTarget } from "./specs";

const ipc = vi.hoisted(() => ({ setGraphFilter: vi.fn() }));
vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));

const summary = { id: 7, name: "app", path: "/work/app" } as RepoSummary;

function target(relative: string | null): TaskTarget {
  return {
    path: "/work/app/src",
    summary,
    scope: relative === null ? null : { relative, isFolder: true },
  };
}

describe("the log task", () => {
  const log = TASK_SPECS.log;
  if (!log) throw new Error("the log task has a spec");

  beforeEach(() => {
    ipc.setGraphFilter.mockResolvedValue({ status: "ok", data: { summary: {}, row: null } });
  });

  it("shows only the history of the folder it was opened on", async () => {
    await log.prepare?.(target("src"));
    expect(ipc.setGraphFilter).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ path: "src", tips: { type: "all" } }),
      null,
    );
  });

  it("shows the whole history for the top of the repository", async () => {
    await log.prepare?.(target(""));
    await log.prepare?.(target(null));
    expect(ipc.setGraphFilter).not.toHaveBeenCalled();
  });

  it("opens the repository's graph, titled with its name", () => {
    expect(log.tabs(target("src"))).toEqual([
      expect.objectContaining({ kind: "repository", path: "/work/app/src", title: "app" }),
    ]);
  });
});

describe("the commit and diff tasks", () => {
  it("open the diff tab first, with the repository's graph behind it", () => {
    for (const task of ["commit", "diff"] as const) {
      const spec = TASK_SPECS[task];
      expect(spec?.tabs(target("src")).map((tab) => tab.kind)).toEqual(["diff", "repository"]);
    }
    expect(TASK_SPECS.commit?.modules).toEqual(["commit"]);
    expect(TASK_SPECS.diff?.modules).toEqual(["changed-files"]);
  });
});
