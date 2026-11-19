import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { RemoteEditor } from "./RemoteEditor";

const ipc = vi.hoisted(() => ({
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
  setRemoteSshKey: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => ({ startFetch: vi.fn(), startJob: vi.fn() }));
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:\\code\\app" }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

function settings(url: string): RemoteSettingsDto {
  return {
    name: "origin",
    head: "main",
    branches: ["main"],
    localBranches: ["main"],
    usesLfs: false,
    sshKey: null,
    entries: [{ key: "remote.origin.url", value: url, scope: "local", file: null, secret: false }],
  };
}

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

describe("Connection tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.previewRemoteChanges.mockReturnValue(ok(["git config …"]));
    ipc.applyRemoteChanges.mockReturnValue(ok(null));
    ipc.setRemoteSshKey.mockReturnValue(ok(null));
  });

  it("keys HTTP settings by the server and warns about not verifying", async () => {
    const user = userEvent.setup();
    ipc.getRemoteSettings.mockReturnValue(ok(settings("https://git.example.com/team/app.git")));
    renderEditor();
    await user.click(await screen.findByRole("tab", { name: "Connection" }));
    expect(screen.getByText("HTTP(S), for https://git.example.com")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Verify the server's certificate"), "false");
    expect(screen.getByText(/could read and change what you fetch and push/)).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Proxy"), "none");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(1, {
      name: "origin",
      newName: null,
      head: null,
      keys: [
        { key: "http.https://git.example.com/.sslVerify", before: [], after: ["false"] },
        { key: "remote.origin.proxy", before: [], after: [""] },
      ],
    });
  });

  it("saves an SSH key as NoBlame's own setting, without git commands", async () => {
    const user = userEvent.setup();
    ipc.getRemoteSettings.mockReturnValue(ok(settings("git@github.com:ada/app.git")));
    renderEditor();
    await user.click(await screen.findByRole("tab", { name: "Connection" }));
    expect(screen.getByText(/not an http\(s\) address/)).toBeVisible();
    await user.type(screen.getByLabelText("SSH key"), "C:/Users/ada/.ssh/id_work");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).not.toHaveBeenCalled();
    const review = await screen.findByRole("dialog", { name: "Save the changes to origin?" });
    expect(
      within(review).getByText(
        "NoBlame's own setting: the SSH key for origin is C:/Users/ada/.ssh/id_work",
      ),
    ).toBeVisible();
    await user.click(within(review).getByRole("button", { name: "Save" }));
    expect(ipc.applyRemoteChanges).not.toHaveBeenCalled();
    expect(ipc.setRemoteSshKey).toHaveBeenCalledWith(1, "origin", "C:/Users/ada/.ssh/id_work");
  });
});
