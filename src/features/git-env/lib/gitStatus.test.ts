import type { GitInfo } from "@/shared/ipc/bindings";

import { describeGitStatus } from "./gitStatus";

vi.mock("@/shared/ipc/bindings", () => ({ commands: {} }));

const info = (overrides: Partial<GitInfo> = {}): GitInfo => ({
  path: "/usr/bin/git",
  version: "2.47.1",
  supported: true,
  minimumVersion: "2.39.0",
  ...overrides,
});

describe("describeGitStatus", () => {
  it("is pending until the check finishes", () => {
    expect(describeGitStatus({}).tone).toBe("pending");
  });

  it("shows the version and path of a supported git", () => {
    const status = describeGitStatus({ data: info() });
    expect(status).toMatchObject({ tone: "ok", label: "Git 2.47.1", hint: null });
    expect(status.detail).toContain("/usr/bin/git");
  });

  it("warns about an old git and names the minimum", () => {
    const status = describeGitStatus({ data: info({ version: "2.30.0", supported: false }) });
    expect(status.tone).toBe("warning");
    expect(status.detail).toContain("2.39.0");
    expect(status.hint).toContain("Upgrade");
  });

  it("passes the backend message and hint through for errors", () => {
    const error = { code: "GIT_NOT_FOUND", message: "Git is not installed.", hint: "Install it." };
    expect(describeGitStatus({ error })).toMatchObject({
      tone: "error",
      detail: "Git is not installed.",
      hint: "Install it.",
    });
  });
});
