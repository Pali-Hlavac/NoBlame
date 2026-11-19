import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { RemoteEditor } from "./RemoteEditor";

const ipc = vi.hoisted(() => ({
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
  testRemoteConnection: vi.fn(),
  askRemoteDefaultBranch: vi.fn(),
  moveRemotePasswords: vi.fn(),
  openWebPage: vi.fn(),
}));
const jobs = vi.hoisted(() => ({ startFetch: vi.fn(), startJob: vi.fn() }));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => jobs);
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:\\code\\app" }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const local = (key: string, value: string, secret = false) => ({
  key,
  value,
  scope: "local" as const,
  file: ".git/config",
  secret,
});

const SETTINGS: RemoteSettingsDto = {
  name: "origin",
  head: "main",
  branches: ["main"],
  localBranches: ["main"],
  entries: [
    local("remote.origin.url", "https://ada:***@github.com/ada/app.git", true),
    local("http.https://github.com/.proxy", "http://proxy.example:8080"),
  ],
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RemoteEditor
        repoId={1}
        name="origin"
        otherRemotes={[]}
        onDirtyChange={vi.fn()}
        onRenamed={vi.fn()}
        onRemove={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("Talking to the remote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.getRemoteSettings.mockReturnValue(ok(SETTINGS));
    ipc.testRemoteConnection.mockReturnValue(ok(7));
    ipc.askRemoteDefaultBranch.mockReturnValue(ok(8));
    ipc.moveRemotePasswords.mockReturnValue(ok(1));
    ipc.openWebPage.mockReturnValue(ok(null));
  });

  it("tests the connection, asks for the default branch and opens the web page", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(ipc.testRemoteConnection).toHaveBeenCalledWith("C:\\code\\app", "origin");
    expect(jobs.startJob).toHaveBeenCalledWith(expect.any(Promise), "testConnection");
    await user.click(screen.getByRole("button", { name: "Ask the server" }));
    expect(ipc.askRemoteDefaultBranch).toHaveBeenCalledWith("C:\\code\\app", "origin");
    await user.click(screen.getByRole("button", { name: "Open in browser" }));
    // Without the user name and password.
    expect(ipc.openWebPage).toHaveBeenCalledWith("https://github.com/ada/app");
  });

  it("moves the password to the credential helper", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(
      await screen.findByRole("button", { name: "Move it to the credential helper" }),
    );
    await waitFor(() => {
      expect(ipc.moveRemotePasswords).toHaveBeenCalledWith(1, "origin");
    });
  });

  it("switches to SSH and offers to move the settings of the old server", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Use SSH" }));
    expect(screen.getByLabelText("URL")).toHaveValue("git@github.com:ada/app.git");
    // An SSH address has no server for http.<url> settings: nothing to move.
    expect(screen.queryByText(/stop applying/)).toBeNull();
    // The password notice waits for the change to be saved or discarded.
    expect(screen.getByRole("button", { name: "Move it to the credential helper" })).toBeDisabled();

    const url = screen.getByLabelText("URL");
    await user.clear(url);
    await user.type(url, "https://gitlab.com/ada/app.git");
    expect(screen.getByText("http.https://github.com/.proxy")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move them to the new server" }));
    expect(screen.queryByText(/stop applying/)).toBeNull();
    expect(screen.getByText("3 changes not saved yet.")).toBeVisible();
  });
});
