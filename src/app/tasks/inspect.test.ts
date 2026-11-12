import type { RepoSummary } from "@/shared/ipc/bindings";

import { blameScopedFile, showScopedHistory } from "./inspect";
import type { TaskTarget } from "./specs";

const features = vi.hoisted(() => ({
  showBlame: vi.fn(),
  showHistory: vi.fn(),
  goToCommit: vi.fn(),
}));
vi.mock("@/features/blame", () => ({ showBlame: features.showBlame }));
vi.mock("@/features/history", () => ({ showHistory: features.showHistory }));
vi.mock("@/features/graph", () => ({ goToCommit: features.goToCommit }));

const summary = { id: 4, name: "app", path: "/work/app" } as RepoSummary;
const HEAD = "a".repeat(40);

function target(relative: string, isFolder: boolean): TaskTarget {
  return { path: `/work/app/${relative}`, summary, scope: { relative, isFolder } };
}

describe("Blame and File history windows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    features.goToCommit.mockResolvedValue({ id: HEAD, row: 0, status: "shown" });
  });

  it("blames the file as it is in HEAD", async () => {
    await blameScopedFile(target("src/main.rs", false));
    expect(features.goToCommit).toHaveBeenCalledWith(4, "HEAD");
    expect(features.showBlame).toHaveBeenCalledWith("/work/app/src/main.rs", {
      commit: HEAD,
      path: "src/main.rs",
    });
  });

  it("says that a folder cannot be blamed", async () => {
    await expect(blameScopedFile(target("src", true))).rejects.toThrow(/this is a folder/);
    expect(features.showBlame).not.toHaveBeenCalled();
  });

  it("shows the history of a file or a folder, and none for the top", () => {
    showScopedHistory(target("src", true));
    expect(features.showHistory).toHaveBeenCalledWith("/work/app/src", {
      path: "src",
      folder: true,
    });
    showScopedHistory(target("", true));
    expect(features.showHistory).toHaveBeenCalledTimes(1);
  });
});
