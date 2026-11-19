import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { ConfigValueDto, RemoteSettingsDto } from "@/shared/ipc/bindings";

import { RemoteEditor } from "./RemoteEditor";

const ipc = vi.hoisted(() => ({
  getRemoteSettings: vi.fn(),
  previewRemoteChanges: vi.fn(),
  applyRemoteChanges: vi.fn(),
  forgetRemoteCredentials: vi.fn(),
  testRemoteConnection: vi.fn(),
}));

vi.mock("@/shared/ipc/bindings", () => ({ commands: ipc }));
vi.mock("@/features/jobs", () => ({ startFetch: vi.fn(), startJob: vi.fn() }));
vi.mock("@/features/repositories", () => ({ useRepositoryPath: () => "C:/code/app" }));
vi.mock("@/features/git-env", () => ({ useGitInfo: () => ({ data: { version: "2.56.0" } }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function ok<T>(data: T) {
  return Promise.resolve({ status: "ok", data });
}

const value = (key: string, text: string, scope: ConfigValueDto["scope"] = "local") => ({
  key,
  value: text,
  scope,
  file: scope === "local" ? null : "C:/Program Files/Git/etc/gitconfig",
  secret: false,
});

function settings(url: string, extra: ConfigValueDto[] = [], usesLfs = false): RemoteSettingsDto {
  return {
    name: "origin",
    head: "main",
    branches: ["main"],
    localBranches: ["main"],
    usesLfs,
    sshKey: null,
    entries: [...extra, value("remote.origin.url", url)],
  };
}

function renderEditor(data: RemoteSettingsDto) {
  ipc.getRemoteSettings.mockReturnValue(ok(data));
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

describe("Credentials tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.previewRemoteChanges.mockReturnValue(ok(["git config …"]));
    ipc.forgetRemoteCredentials.mockReturnValue(ok(1));
  });

  it("warns without a helper and keys settings by the server", async () => {
    const user = userEvent.setup();
    renderEditor(settings("https://git.example.com/team/app.git"));
    await user.click(await screen.findByRole("tab", { name: "Credentials" }));
    expect(screen.getByText(/None: git asks for your password every time/)).toBeVisible();
    expect(screen.queryByLabelText("Kind of server")).toBeNull();
    await user.type(screen.getByLabelText("User name"), "ada");
    await user.selectOptions(screen.getByLabelText("A separate sign-in per repository"), "true");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(1, {
      name: "origin",
      newName: null,
      head: null,
      keys: [
        { key: "credential.https://git.example.com.username", before: [], after: ["ada"] },
        { key: "credential.https://git.example.com.useHttpPath", before: [], after: ["true"] },
      ],
    });
  });

  it("shows Git Credential Manager and the Azure DevOps account of the organization", async () => {
    const user = userEvent.setup();
    renderEditor(
      settings("https://contoso@dev.azure.com/contoso/Web/_git/app", [
        value("credential.helper", "manager", "system"),
      ]),
    );
    await user.click(await screen.findByRole("tab", { name: "Credentials" }));
    expect(screen.getByText("Git Credential Manager")).toBeVisible();
    expect(screen.getByLabelText("Kind of server")).toBeVisible();
    expect(screen.getByText("Azure DevOps, organization contoso")).toBeVisible();
    await user.type(screen.getByLabelText("Account for this organization"), "ada@contoso.com");
    await user.selectOptions(screen.getByLabelText("Sign in to Azure DevOps with"), "pat");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        keys: [
          {
            key: "credential.azrepos:org/contoso.username",
            before: [],
            after: ["ada@contoso.com"],
          },
          {
            key: "credential.https://dev.azure.com.azreposCredentialType",
            before: [],
            after: ["pat"],
          },
        ],
      }),
    );
  });

  it("forgets the saved sign-in after asking", async () => {
    const user = userEvent.setup();
    renderEditor(
      settings("https://github.com/ada/app.git", [value("credential.helper", "manager", "system")]),
    );
    await user.click(await screen.findByRole("tab", { name: "Credentials" }));
    await user.click(screen.getByRole("button", { name: "Forget the saved sign-in…" }));
    const dialog = await screen.findByRole("dialog", { name: "Forget the sign-in for origin?" });
    await user.click(within(dialog).getByRole("button", { name: "Forget" }));
    expect(ipc.forgetRemoteCredentials).toHaveBeenCalledWith(1, "origin");
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Forgot the sign-in for origin");
    });
  });

  it("says SSH remotes sign in with their key", async () => {
    const user = userEvent.setup();
    renderEditor(settings("git@github.com:ada/app.git"));
    await user.click(await screen.findByRole("tab", { name: "Credentials" }));
    expect(screen.getByText(/signs in with your SSH key/)).toBeVisible();
  });
});

describe("LFS tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipc.previewRemoteChanges.mockReturnValue(ok(["git config …"]));
  });

  it("is shown only when the repository uses LFS", async () => {
    renderEditor(settings("https://github.com/ada/app.git"));
    await screen.findByRole("tab", { name: "Credentials" });
    expect(screen.queryByRole("tab", { name: "LFS" })).toBeNull();
  });

  it("keys the lock check by the LFS server git-lfs works out", async () => {
    const user = userEvent.setup();
    renderEditor(settings("git@github.com:ada/app.git", [], true));
    await user.click(await screen.findByRole("tab", { name: "LFS" }));
    expect(screen.getByLabelText("LFS server")).toHaveAttribute(
      "placeholder",
      "https://github.com/ada/app.git/info/lfs",
    );
    await user.selectOptions(screen.getByLabelText("Check locks before pushing"), "false");
    await user.click(screen.getByRole("button", { name: "Review and save…" }));
    expect(ipc.previewRemoteChanges).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        keys: [
          {
            key: "lfs.https://github.com/ada/app.git/info/lfs.locksverify",
            before: [],
            after: ["false"],
          },
        ],
      }),
    );
  });
});
